import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import DynamoDB from "aws-sdk/clients/dynamodb"
import { Product, ProductRepository } from "/opt/nodejs/productsLayer"
import { Lambda } from "aws-sdk"
import { ProductEvent, ProductEventType } from "/opt/nodejs/productEventsLayer"

const productsDdbTableName = process.env.PRODUCTS_DDB_TABLE_NAME!
const ddbClient = new DynamoDB.DocumentClient()
const productEventsFunctionName = process.env.PRODUCTS_EVENTS_FUNCTION_NAME!
const lambdaClient = new Lambda()

const productRepository = new ProductRepository(ddbClient, productsDdbTableName)

export async function handler(event: APIGatewayProxyEvent,
  context: Context): Promise<APIGatewayProxyResult> {

  const lambdaRequestId = context.awsRequestId
  const apiRequestId = event.requestContext.requestId

  console.log(`Api Gateway Request ID: ${apiRequestId} - Lambda Request ID: ${lambdaRequestId}`)

  if (event.resource === "/products") {
    console.log("POST /products")
    const product = JSON.parse(event.body!) as Product
    const productCreated = await productRepository.createProduct(product)

    const response = await sendProductEvent(productCreated, ProductEventType.CREATED, "evertonteste@gmail.com", lambdaRequestId)
    console.log(response)

    return {
      statusCode: 201,
      body: JSON.stringify(productCreated)
    }
  } else if (event.resource === "/products/{id}") {
    const productId = event.pathParameters!.id as string

    const method = event.httpMethod
    if (method === 'PUT') {
      console.log(`PUT /products/${productId}`)

      try {
        const product = JSON.parse(event.body!) as Product
        const productUpdated = await productRepository.updateProduct(productId, product)

        const response = await sendProductEvent(productUpdated, ProductEventType.UPDATED, "evertonteste@gmail.com", lambdaRequestId)
        console.log(response)

        return {
          statusCode: 200,
          body: JSON.stringify(productUpdated)
        }
      } catch (ConditionalCheckFailedException) {
        return {
          statusCode: 404,
          body: 'Product not found'
        }
      }
    } else if (method === 'DELETE') {
      console.log(`DELETE /products/${productId}`)

      try {
        const productDeleted = await productRepository.deleteProduct(productId)

        const response = await sendProductEvent(productDeleted, ProductEventType.DELETED, "evertonteste@gmail.com", lambdaRequestId)
        console.log(response)

        return {
          statusCode: 200,
          body: JSON.stringify(productDeleted)
        }
      } catch (error) {
        console.error((<Error>error).message)

        return {
          statusCode: 404,
          body: (<Error>error).message
        }
      }
    }
  }


  return {
    statusCode: 400,
    body: JSON.stringify({ message: "Bad request" })
  }
}

function sendProductEvent(product: Product, eventType: ProductEventType, email: string, lambdaRequestId: string) {
  const event: ProductEvent = {
    email,
    eventType,
    productCode: product.code,
    productId: product.id,
    productPrice: product.price,
    requestId: lambdaRequestId,
  }

  return lambdaClient.invoke({
    FunctionName: productEventsFunctionName,
    InvocationType: 'Event',
    Payload: JSON.stringify(event)
  }).promise()
}