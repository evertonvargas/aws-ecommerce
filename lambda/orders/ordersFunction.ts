import { APIGateway, DynamoDB } from "aws-sdk"
import { Order, OrderRepository } from "/opt/nodejs/ordersLayer"
import { Product, ProductRepository } from "/opt/nodejs/productsLayer"
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import { CarrierType, OrderProductResponse, OrderRequest, OrderResponse, PaymentType, ShippingType } from "/opt/nodejs/ordersApiLayer"

const ordersDdb = process.env.ORDERS_DDB_TABLE_NAME!
const productsDdb = process.env.PRODUCTS_DDB_TABLE_NAME!

const ddbClient = new DynamoDB.DocumentClient()

const orderRepository = new OrderRepository(ddbClient, ordersDdb)
const productRepository = new ProductRepository(ddbClient, productsDdb)

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod
  const lambdaRequestId = context.awsRequestId
  const apiRequestId = event.requestContext.requestId

  console.log(`Api Gateway Request ID: ${apiRequestId} - Lambda Request ID: ${lambdaRequestId}`)

  if (method === 'GET') {
    if (event.queryStringParameters) {
      const email = event.queryStringParameters!.email
      const orderId = event.queryStringParameters!.orderId

      if (email && orderId) {
        // get order from user by orderId
        try {
          const order = await orderRepository.getOrder(email, orderId)

          return {
            statusCode: 200,
            body: JSON.stringify(convertToOrderResponse(order))
          }
        } catch (error) {
          console.log((<Error>error).message)
          return {
            statusCode: 404,
            body: (<Error>error).message
          }
        }
      }

      if (email) {
        // get all orders from user
        const orders = await orderRepository.getOrdersByEmail(email)

        return {
          statusCode: 200,
          body: JSON.stringify(orders.map(convertToOrderResponse))
        }
      }
    } else {
      // get all orders
      const orders = await orderRepository.getAllOrders()

      return {
        statusCode: 200,
        body: JSON.stringify(orders.map(convertToOrderResponse))
      }
    }

  } else if (method === 'POST') {
    console.log('POST /orders')

    const orderRequest = JSON.parse(event.body!) as OrderRequest

    const products = await productRepository.getProductsByIds(orderRequest.productIds)

    if (products.length === orderRequest.productIds.length) {
      const order = buildOrder(orderRequest, products)
      const orderCreated = await orderRepository.createOrder(order)

      return {
        statusCode: 201,
        body: JSON.stringify(convertToOrderResponse(orderCreated))
      }
    }
    else {
      return {
        statusCode: 404,
        body: "Some product was not found"
      }
    }
  }
  else if (method === 'DELETE') {
    console.log('DELETE /orders')
    const email = event.queryStringParameters!.email!
    const orderId = event.queryStringParameters!.orderId!

    try {
      const orderDelete = await orderRepository.deleteOrder(email, orderId)

      return {
        statusCode: 200,
        body: JSON.stringify(convertToOrderResponse(orderDelete))
      }
    } catch (error) {
      console.log((<Error>error).message)
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

// conversão da requisição para o formato do DynamoDB
function buildOrder(orderRequest: OrderRequest, products: Product[]): Order {
  const orderProducts: OrderProductResponse[] = []
  let totalPrice = 0

  products.forEach((product) => {
    totalPrice += product.price
    orderProducts.push({
      code: product.code,
      price: product.price
    })
  })

  const order: Order = {
    pk: orderRequest.email,
    billing: {
      payment: orderRequest.payment,
      totalPrice: totalPrice
    },
    shipping: {
      type: orderRequest.shipping.type,
      carrier: orderRequest.shipping.carrier
    },
    products: orderProducts
  }

  return order
}

function convertToOrderResponse(order: Order): OrderResponse {
  const orderProducts: OrderProductResponse[] = []
  order.products.forEach((product) => {
    orderProducts.push({
      code: product.code,
      price: product.price
    })
  })

  const orderResponse: OrderResponse = {
    email: order.pk,
    id: order.sk!,
    createdAt: order.createdAt!,
    products: orderProducts,
    billing: {
      payment: order.billing.payment as PaymentType,
      totalPrice: order.billing.totalPrice
    },
    shipping: {
      type: order.shipping.type as ShippingType,
      carrier: order.shipping.carrier as CarrierType
    }
  }

  return orderResponse
}