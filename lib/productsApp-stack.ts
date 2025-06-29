import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from "aws-cdk-lib/aws-ssm"
import { Construct } from 'constructs';

interface ProductsAppStackProps extends cdk.StackProps {
    eventsDdb: dynamodb.Table;
}

export class ProductsAppStack extends cdk.Stack {

    readonly productsFetchHandler: lambdaNodejs.NodejsFunction;
    readonly productsAdminHandler: lambdaNodejs.NodejsFunction;
    readonly productsDdb: dynamodb.Table;

    constructor(scope: Construct, id: string, props: ProductsAppStackProps) {
        super(scope, id, props);

        this.productsDdb = new dynamodb.Table(this, "ProductsDdb", {
            tableName: "products",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: "id",
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })

        //Products Layer
        const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, "ProductsLayerVersionArn")
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "ProductsLayerVersionArn", productsLayerArn)

        // Product Events Layer
        const productsEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, "ProductEventsLayerVersionArn")
        const productsEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "ProductEventsLayerVersionArn", productsEventsLayerArn)

        const productEventsHandler = new lambdaNodejs.NodejsFunction(this, 'ProductEventsFunction', {
            functionName: 'ProductEventsFunction',
            entry: 'lambda/products/productEventsFunction.ts',
            handler: 'handler',
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 512,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            environment: {
                EVENTS_DDB_TABLE_NAME: props.eventsDdb.tableName
            },
            layers: [productsEventsLayer],
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
        });
        props.eventsDdb.grantWriteData(productEventsHandler);

        this.productsFetchHandler = new lambdaNodejs.NodejsFunction(this, 'ProductsFetchFunction', {
            functionName: 'ProductsFetchFunction',
            entry: 'lambda/products/productsFetchFunction.ts',
            handler: 'handler',
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 512,
            timeout: cdk.Duration.seconds(10),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            environment: {
                PRODUCTS_DDB_TABLE_NAME: this.productsDdb.tableName
            },
            layers: [productsLayer],
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
        });

        // give acess read to the productsDdb table
        this.productsDdb.grantReadData(this.productsFetchHandler);

        this.productsAdminHandler = new lambdaNodejs.NodejsFunction(this, 'ProductsAdminFunction', {
            functionName: 'ProductsAdminFunction',
            entry: 'lambda/products/productsAdminFunction.ts',
            handler: 'handler',
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 512,
            timeout: cdk.Duration.seconds(10),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            environment: {
                PRODUCTS_DDB_TABLE_NAME: this.productsDdb.tableName,
                PRODUCTS_EVENTS_FUNCTION_NAME: productEventsHandler.functionName,
            },
            layers: [productsLayer, productsEventsLayer],
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
        });

        this.productsDdb.grantWriteData(this.productsAdminHandler);
        productEventsHandler.grantInvoke(this.productsAdminHandler);
    }
}