import { Callback, Context } from "aws-lambda"
import { DynamoDB } from "aws-sdk"
import { ProductEvent } from "/opt/nodejs/productEventsLayer"

const ddbClient = new DynamoDB.DocumentClient()
const eventsDdb = process.env.EVENTS_DDB_TABLE_NAME!

export async function handler(event: ProductEvent, context: Context, callback: Callback) {
  console.log("Event received:", event)
  console.log(`Lambda requestId: ${context.awsRequestId}`)

  await createEvent(event)

  // deu tudo certo, vamos retornar o callback
  callback(null, JSON.stringify({
    productEventCreated: true,
    message: "OK",
  }))
}

function createEvent(event: ProductEvent) {
  const timestamp = Date.now()
  const ttl = ~~(timestamp / 1000 + 5 * 60)

  return ddbClient.put({
    TableName: eventsDdb,
    Item: {
      pk: `#product_${event.productCode}`,
      sk: `${event.eventType}#${timestamp}`,
      email: event.email,
      createdAt: timestamp,
      requestId: event.requestId,
      eventType: event.eventType,
      info: {
        productId: event.productId,
        price: event.productPrice
      },
      ttl: ttl
    }
  }).promise()
}