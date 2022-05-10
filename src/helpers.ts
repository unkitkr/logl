import fetch from 'node-fetch'
import airtable from 'airtable'
import qs from 'qs'
import { capitalize } from 'lodash'
import 'dotenv/config'
const environmentVariables = process.env

export interface IMessageBody {
  update_id: string
  message: Message
}

export interface Message {
  message_id: string
  from: From
  chat: Chat
  date: string
  text: string
  entities: Entity[]
}

export interface Chat {
  id: string
  first_name: string
  last_name: string
  type: string
}

export interface Entity {
  offset: string
  length: string
  type: string
  url: string
}

export interface From {
  id: string
  is_bot: boolean
  first_name: string
  last_name: string
  language_code: string
}

interface IParsedMessage {
  command: string
  message: string
}

interface IProcessedPayload {
  messageId: string
  messengerId: string
  firstName: string
  lastName: string
  rawMessage: string
  date: string
  chatId: string
  userId: string
}

export class commandProcessor {
  private parsedMessage: IParsedMessage
  private isAuthencated: boolean = false
  private processedData: IProcessedPayload

  //keep action as a parameter to have felxibility of the function later
  private sendMessage = async (
    action: string,
    params: { [key: string]: string }
  ) => {
    const paramString = qs.stringify(params)
    const urlEndpoint = `https://api.telegram.org/bot${environmentVariables.TELEGRAM_BOT_ID}/${action}?${paramString}`
    const res = await fetch(urlEndpoint, {
      method: 'GET',
    })
  }

  private db = new airtable({
    apiKey: environmentVariables.API_KEY_AIRTABLE,
    endpointUrl: 'https://api.airtable.com',
  }).base(environmentVariables.AIRTABLE_BASE_ID!)

  private statusDb = this.db.table(environmentVariables.API_KEY_STATUS_DB!)
  private subscribersDb = this.db.table(
    environmentVariables.API_KEY_SUBSCRIBERS_DB!
  )
  private availableDb = this.db.table(
    environmentVariables.API_KEY_AVAILABLE_DB!
  )

  private newStatus = async () => {
    const messageRecieved = this.parsedMessage.message.split(' ')
    if (messageRecieved && messageRecieved.length < 2) {
      await this.sendMessage('sendMessage', {
        text: `The format to send new status is : category1,cattegory2.. <space> status`,
        reply_to_message_id: this.processedData.messageId,
        chat_id: this.processedData.chatId,
      })
      return {
        statusCode: 200,
      }
    }

    const cat = messageRecieved[0].split(',')
    const msg = messageRecieved.slice(1).join(' ')
    try {
      const status = await this.statusDb.create(
        [
          {
            fields: {
              status: msg,
              category: cat,
            },
          },
        ],
        {
          typecast: true,
        }
      )
      const id = status[0].getId()
      if (status.length && status.length > 0) {
        await this.sendMessage('sendMessage', {
          text: `status sent with id ${id}`,
          reply_to_message_id: this.processedData.messageId,
          chat_id: this.processedData.chatId,
        })
        return {
          statusCode: 200,
        }
      }
    } catch (e) {
      console.log(e)
    }
  }
  private deletestatus = async () => {
    const deleted = await this.statusDb.destroy([this.parsedMessage.message])
    if (deleted && deleted.length > 0) {
      this.sendMessage('sendMessage', {
        text: `status sent with id ${deleted[0].id}`,
        reply_to_message_id: this.processedData.messageId,
        chat_id: this.processedData.chatId,
      })
    } else {
      this.sendMessage('sendMessage', {
        text: `Deletion failed. Check if id ${this.parsedMessage.message} exist.`,
        reply_to_message_id: this.processedData.messageId,
        chat_id: this.processedData.chatId,
      })
    }
  }
  private subscribeUser = async () => {
    const alreadySubscribed = await this.subscribersDb
      .select({ filterByFormula: `{user_id} = ${this.processedData.userId}` })
      .all()
    if (alreadySubscribed && alreadySubscribed.length > 0) {
      this.sendMessage('sendMessage', {
        text: `Hey ${capitalize(
          this.processedData.firstName
        )} you're already subscribed 😄`,
        reply_to_message_id: this.processedData.messageId,
        chat_id: this.processedData.chatId,
      })
    } else {
      const subscribedUser = await this.subscribersDb.create([
        {
          fields: {
            first_name: this.processedData.firstName,
            last_name: this.processedData.lastName,
            chat_id: String(this.processedData.chatId),
            user_id: String(this.processedData.userId),
          },
        },
      ])
      if (subscribedUser && subscribedUser.length > 0) {
        this.sendMessage('sendMessage', {
          text: `Thanks for subscribing ${capitalize(
            this.processedData.firstName
          )}`,
          reply_to_message_id: this.processedData.messageId,
          chat_id: this.processedData.chatId,
        })
      } else {
        this.sendMessage('sendMessage', {
          text: `Hey ${capitalize(
            this.processedData.firstName
          )} we encountered an error on our side`,
          reply_to_message_id: this.processedData.messageId,
          chat_id: this.processedData.chatId,
        })
      }
    }
  }
  private unsubscribeUser = async () => {
    const userExist = await this.subscribersDb
      .select({ filterByFormula: `{user_id} = ${this.processedData.userId}` })
      .all()
    if (!userExist) {
      this.sendMessage('sendMessage', {
        text: `Hey ${capitalize(
          this.processedData.firstName
        )} you're not subscribed 😄`,
        reply_to_message_id: this.processedData.messageId,
        chat_id: this.processedData.chatId,
      })
    } else {
      const deleted = await this.subscribersDb.destroy([userExist[0].getId()])
      if (deleted && deleted.length > 0) {
        this.sendMessage('sendMessage', {
          text: `Outch! But the good thing is you're unsubscribed 😄`,
          reply_to_message_id: this.processedData.messageId,
          chat_id: this.processedData.chatId,
        })
      }
    }
  }
  private updateStatus = async () => {
    const parsed = this.parsedMessage.message.split(' ')
    const id = parsed[0]
    const message = parsed[1]
    const update = await this.statusDb.update([
      {
        id,
        fields: {
          status: message,
        },
      },
    ])
    if (update && update.length > 0) {
      this.sendMessage('sendMessage', {
        text: `status updated with id ${update[0].id}`,
        reply_to_message_id: this.processedData.messageId,
        chat_id: this.processedData.chatId,
      })
    } else {
      this.sendMessage('sendMessage', {
        text: `updation failed check if id ${id} exist`,
        reply_to_message_id: this.processedData.messageId,
        chat_id: this.processedData.chatId,
      })
    }
  }

  private start = async () => {
    this.sendMessage('sendMessage', {
      text: `Hello there! use command: \n /subscribe to subscribe to my updates \n /unsubscribe to stop getting updates`,
      chat_id: this.processedData.chatId,
    })
  }

  private available = async () => {
    const availableStatusStrings = new Set([
      'avl',
      'lavl',
      'navl',
      'onph',
      'onem',
    ])
    const status = this.parsedMessage.message
    if (availableStatusStrings.has(status)) {
      const updated = await this.availableDb.update([
        {
          id: 'recWGSWBplYEA2f7B',
          fields: {
            currentstatus: status,
          },
        },
      ])
      console.log(updated)
      if (updated && updated.length > 0) {
        this.sendMessage('sendMessage', {
          text: `Availability updated with ${status}`,
          reply_to_message_id: this.processedData.messageId,
          chat_id: this.processedData.chatId,
        })
      }
    } else {
      this.sendMessage('sendMessage', {
        text: `I didn't quiet understood that your status must be one of the ${Array.from(
          availableStatusStrings
        ).join(', ')}`,
        reply_to_message_id: this.processedData.messageId,
        chat_id: this.processedData.chatId,
      })
    }
  }

  private commandDispatcher = new Map<string, Function>([
    ['/newstatus', this.newStatus],
    ['/deletestatus', this.deletestatus],
    ['/subscribe', this.subscribeUser],
    ['/unsubscribe', this.unsubscribeUser],
    ['/updatestatus', this.updateStatus],
    ['/available', this.available],
    ['/start', this.start],
  ])

  private needsAuth = new Set([
    '/newstatus',
    '/deletestatus',
    '/updatestatus',
    '/available',
  ])

  constructor({
    parsedMessage,
    rawData,
  }: {
    parsedMessage: IParsedMessage
    rawData: IProcessedPayload
  }) {
    this.parsedMessage = parsedMessage
    this.processedData = rawData
  }

  private authentication = () => {
    String(this.processedData.messengerId) ===
    environmentVariables.TELEGRAM_ACCOUNT_ID!
      ? (this.isAuthencated = true)
      : false
  }

  private commandNeedsAuth = (command: string) => {
    return this.needsAuth.has(command)
  }

  private commandValidiator = (command: string) => {
    return this.commandDispatcher.has(command)
  }

  private messageDispatcher = async () => {
    this.authentication()
    const commandRecieved: string = this.parsedMessage.command
    const commandIsValid = this.commandValidiator(commandRecieved)
    if (commandIsValid) {
      let res
      const functionToExec = this.commandDispatcher.get(commandRecieved)!
      const commanNeedsAuth =
        commandIsValid && this.commandNeedsAuth(commandRecieved)
      if (commanNeedsAuth) {
        res = await this.commandRunner(functionToExec, true)
      } else {
        res = await this.commandRunner(functionToExec, false)
      }
      return res
    } else {
      return 404
    }
  }

  private commandRunner = async (fn: Function, needAuth: boolean) => {
    const runner = fn
    const authRequired = Boolean(needAuth)
    if (authRequired) {
      if (this.isAuthencated) {
        const res = await runner()
        return res
      } else {
        return 401
      }
    } else {
      const res = await runner()
      return res
    }
  }

  public process = () => {
    this.messageDispatcher().then((data) =>
      console.log(`Processing complete ${JSON.stringify(data)}`)
    )
  }
}

export const messageParser = (message: string) => {
  const rMessage = String(message)
  const isCommand = rMessage.charAt(0) === '/' ? true : false
  if (isCommand) {
    const parsed = rMessage.split(' ')
    const command = parsed[0]
    return { command: command, message: parsed.slice(1).join(' ') }
  }
  return undefined
}

export const bodyParser = (obj: object) => {
  const parsed: IMessageBody = obj as IMessageBody
  const messageId = parsed.message.message_id
  const chatId = parsed.message.chat.id
  const senderDetails = parsed.message.from
  const message = parsed.message.text
  const date = parsed.message.date
  const userId = parsed.message.from.id
  return {
    messageId,
    messengerId: senderDetails.id,
    firstName: senderDetails.first_name,
    lastName: senderDetails.last_name,
    rawMessage: message,
    chatId,
    date,
    userId,
  }
}
