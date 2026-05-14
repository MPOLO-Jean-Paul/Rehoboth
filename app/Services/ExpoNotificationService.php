<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExpoNotificationService
{
    protected const EXPO_API_URL = 'https://exp.host/--/api/v2/push/send';

    /**
     * Send a push notification to one or more Expo push tokens.
     *
     * @param string|array $to
     * @param string $title
     * @param string $body
     * @param array $data
     * @param string $priority
     * @return bool
     */
    public static function send($to, string $title, string $body, array $data = [], string $priority = 'high')
    {
        $tokens = is_array($to) ? $to : [$to];
        
        // Filter out empty tokens
        $tokens = array_filter($tokens);

        if (empty($tokens)) {
            return false;
        }

        $messages = [];
        foreach ($tokens as $token) {
            $channelId = in_array(($data['priority'] ?? $data['type'] ?? null), ['urgent', 'emergency'], true)
                ? 'medical-alerts'
                : 'default';

            $messages[] = [
                'to' => $token,
                'title' => $title,
                'body' => $body,
                'data' => $data,
                'sound' => 'default',
                'priority' => $priority,
                'channelId' => $channelId,
            ];
        }

        try {
            $response = Http::post(self::EXPO_API_URL, $messages);
            
            if ($response->successful()) {
                return true;
            }

            Log::error('Expo Push Notification Error: ' . $response->body());
            return false;
        } catch (\Exception $e) {
            Log::error('Expo Push Notification Exception: ' . $e->getMessage());
            return false;
        }
    }
}
