import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import DynamoDB from "aws-sdk/clients/dynamodb"
import { ProductRepository } from "/opt/nodejs/productsLayer"

const productsDdbTableName = process.env.PRODUCTS_DDB_TABLE_NAME!
const ddbClient = new DynamoDB.DocumentClient()

const productRepository = new ProductRepository(ddbClient, productsDdbTableName)

export async function handler(event: APIGatewayProxyEvent,
    context: Context): Promise<APIGatewayProxyResult> {

    const lambdaRequestId = context.awsRequestId
    const apiRequestId = event.requestContext.requestId

    console.log(`Api Gateway Request ID: ${apiRequestId} - Lambda Request ID: ${lambdaRequestId}`)

    const method = event.httpMethod

    if (event.resource === "/products") {
        if (method === 'GET') {
            console.log('GET /products')

            const products = await productRepository.getAllProducts()

            return {
                statusCode: 200,
                body: JSON.stringify(products)
            }
        }
    } else if (event.resource === "/products/{id}") {
        const productId = event.pathParameters!.id as string

        console.log(`GET /products/${productId}`)

        try {
            const product = await productRepository.getProductById(productId)

            return {
                statusCode: 200,
                body: JSON.stringify(product)
            }
        } catch (error) {
            console.error((<Error>error).message)
            return {
                statusCode: 404,
                body: (<Error>error).message
            }
        }

    }

    return {
        statusCode: 400,
        body: JSON.stringify({ message: "Bad request" })
    }
}