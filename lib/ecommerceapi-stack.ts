import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cwlogs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface EcommerceStackProps extends cdk.StackProps {
    productFetchHandler: lambdaNodejs.NodejsFunction;
    productAdminHandler: lambdaNodejs.NodejsFunction;
    ordersHandler: lambdaNodejs.NodejsFunction;
}

export class EcommerceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: EcommerceStackProps) {
        super(scope, id, props);

        const logGroup = new cwlogs.LogGroup(this, 'EcommerceApiLogs')

        const api = new apigateway.RestApi(this, 'EcommerceApi', {
            restApiName: 'EcommerceApi',
            cloudWatchRole: true,
            deployOptions: {
                accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    caller: true,
                    user: true
                })
            }
        })

        // integra API Gateway with Lambda
        this.createProductsService(props, api);

        this.createOrdersService(props, api);
    }

    private createProductsService(props: EcommerceStackProps, api: apigateway.RestApi) {
        const productsFetchIntegration = new apigateway.LambdaIntegration(props.productFetchHandler);

        // "/products"
        const productsResource = api.root.addResource('products');
        productsResource.addMethod('GET', productsFetchIntegration);

        // "/products/:id"
        const productIdResource = productsResource.addResource('{id}');
        productIdResource.addMethod('GET', productsFetchIntegration);

        // POST "/products"
        const productsAdminIntegration = new apigateway.LambdaIntegration(props.productAdminHandler);

        const productsAdminRequestValidator = new apigateway.RequestValidator(this, "ProductsAdminRequestValidator", {
            restApi: api,
            requestValidatorName: "Products admin request validator",
            validateRequestBody: true
        })

        const productsAdminModel = new apigateway.Model(this, "ProductsAdminModel", {
            modelName: "ProductsAdminModel",
            restApi: api,
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    productName: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    code: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    model: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    productUrl: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    price: {
                        type: apigateway.JsonSchemaType.NUMBER
                    },
                },
                required: [
                    "productName",
                    "code"
                ]
            }
        })

        productsResource.addMethod('POST', productsAdminIntegration, {
            requestValidator: productsAdminRequestValidator,
            requestModels: {
                "application/json": productsAdminModel
            }
        });

        // PUT "/products/:id"
        productIdResource.addMethod('PUT', productsAdminIntegration, {
            requestValidator: productsAdminRequestValidator,
            requestModels: {
                "application/json": productsAdminModel
            }
        });

        // DELETE "/products/:id"
        productIdResource.addMethod('DELETE', productsAdminIntegration);
    }

    private createOrdersService(props: EcommerceStackProps, api: apigateway.RestApi) {
        const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler)

        //resource - /orders
        const ordersResource = api.root.addResource('orders')

        //GET /orders
        //GET /orders?email=matilde@siecola.com.br
        //GET /orders?email=matilde@siecola.com.br&orderId=123
        ordersResource.addMethod("GET", ordersIntegration)


        const orderDeletionValidator = new apigateway.RequestValidator(this, "OrderDeletionValidator", {
            restApi: api,
            requestValidatorName: "OrderDeletionValidator",
            validateRequestParameters: true
        })

        //DELETE /orders?email=matilde@siecola.com.br&orderId=123
        ordersResource.addMethod("DELETE", ordersIntegration, {
            requestParameters: {
                'method.request.querystring.email': true,
                'method.request.querystring.orderId': true
            },
            requestValidator: orderDeletionValidator
        })

        const orderRequestValidator = new apigateway.RequestValidator(this, "OrderRequestValidator", {
            restApi: api,
            requestValidatorName: "Order request validator",
            validateRequestBody: true
        })

        const orderModel = new apigateway.Model(this, "OrderModel", {
            modelName: "OrderModel",
            restApi: api,
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    email: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    productIds: {
                        type: apigateway.JsonSchemaType.ARRAY,
                        minItems: 1,
                        items: {
                            type: apigateway.JsonSchemaType.STRING
                        }
                    },
                    payment: {
                        type: apigateway.JsonSchemaType.STRING,
                        enum: ["CASH", "DEBIT_CARD", "CREDIT_CARD"]
                    }
                },
                required: [
                    "email",
                    "productIds",
                    "payment"
                ]
            }
        })

        //POST /orders
        ordersResource.addMethod("POST", ordersIntegration, {
            requestValidator: orderRequestValidator,
            requestModels: {
                "application/json": orderModel
            }
        })
    }
}