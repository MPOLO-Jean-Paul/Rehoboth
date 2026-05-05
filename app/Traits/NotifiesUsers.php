<?php

namespace App\Traits;

use App\Models\User;
use App\Models\Notification;
use App\Services\ExpoNotificationService;

trait NotifiesUsers
{
    /**
     * Notify users of a specific role.
     */
    public function notifyRole(string $role, string $title, string $body, array $data = [])
    {
        $tokens = User::where('role', $role)
            ->whereNotNull('expo_push_token')
            ->pluck('expo_push_token')
            ->toArray();

        // Persist in DB
        Notification::create([
            'role' => $role,
            'title' => $title,
            'body' => $body,
            'data' => $data,
            'type' => $data['type'] ?? 'info'
        ]);

        if (empty($tokens)) {
            return false;
        }

        return ExpoNotificationService::send($tokens, $title, $body, array_merge(['role' => $role], $data));
    }

    /**
     * Notify a specific user.
     */
    public function notifyUser($userId, string $title, string $body, array $data = [])
    {
        $user = User::find($userId);
        if (!$user) {
            return false;
        }

        // Persist in DB
        Notification::create([
            'user_id' => $user->id,
            'title' => $title,
            'body' => $body,
            'data' => $data,
            'type' => $data['type'] ?? 'info'
        ]);

        if (!$user->expo_push_token) {
            return false;
        }

        return ExpoNotificationService::send($user->expo_push_token, $title, $body, $data);
    }
}
