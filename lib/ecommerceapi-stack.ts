import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cwlogs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface EcommerceStackProps extends cdk.StackProps {
    productFetchHandler: lambdaNodejs.NodejsFunction;
    productAdminHandler: lambdaNodejs.NodejsFunction;
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
        const productsFetchIntegration = new apigateway.LambdaIntegration(props.productFetchHandler)

        // "/products"
        const productsResource = api.root.addResource('products');
        productsResource.addMethod('GET', productsFetchIntegration)

        // "/products/:id"
        const productIdResource = productsResource.addResource('{id}');
        productIdResource.addMethod('GET', productsFetchIntegration);

        // POST "/products"
        const productsAdminIntegration = new apigateway.LambdaIntegration(props.productAdminHandler)
        productsResource.addMethod('POST', productsAdminIntegration)

        // PUT "/products/:id"
        productIdResource.addMethod('PUT', productsAdminIntegration);
        
        // DELETE "/products/:id"
        productIdResource.addMethod('DELETE', productsAdminIntegration);
    }
}