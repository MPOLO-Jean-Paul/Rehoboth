<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'mobile_money' => [
        'timeout' => env('MOBILE_MONEY_TIMEOUT', 30),
        'callback_url' => env('MOBILE_MONEY_CALLBACK_URL'),
        'providers' => [
            'orange' => [
                'endpoint' => env('ORANGE_MONEY_ENDPOINT'),
                'client_id' => env('ORANGE_MONEY_CLIENT_ID', 'orange-client-id-demo'),
                'client_secret' => env('ORANGE_MONEY_CLIENT_SECRET', 'orange-client-secret-demo'),
                'merchant_id' => env('ORANGE_MONEY_MERCHANT_ID', 'orange-merchant-demo'),
                'cdf_account' => env('ORANGE_MONEY_CDF_ACCOUNT', 'orange-cdf-account-demo'),
                'usd_account' => env('ORANGE_MONEY_USD_ACCOUNT', 'orange-usd-account-demo'),
            ],
            'airtel' => [
                'endpoint' => env('AIRTEL_MONEY_ENDPOINT'),
                'client_id' => env('AIRTEL_MONEY_CLIENT_ID', 'airtel-client-id-demo'),
                'client_secret' => env('AIRTEL_MONEY_CLIENT_SECRET', 'airtel-client-secret-demo'),
                'merchant_id' => env('AIRTEL_MONEY_MERCHANT_ID', 'airtel-merchant-demo'),
                'cdf_account' => env('AIRTEL_MONEY_CDF_ACCOUNT', 'airtel-cdf-account-demo'),
                'usd_account' => env('AIRTEL_MONEY_USD_ACCOUNT', 'airtel-usd-account-demo'),
            ],
            'mpesa' => [
                'endpoint' => env('MPESA_ENDPOINT'),
                'client_id' => env('MPESA_CLIENT_ID', 'mpesa-client-id-demo'),
                'client_secret' => env('MPESA_CLIENT_SECRET', 'mpesa-client-secret-demo'),
                'merchant_id' => env('MPESA_MERCHANT_ID', 'mpesa-merchant-demo'),
                'cdf_account' => env('MPESA_CDF_ACCOUNT', 'mpesa-cdf-account-demo'),
                'usd_account' => env('MPESA_USD_ACCOUNT', 'mpesa-usd-account-demo'),
            ],
        ],
    ],

];
