<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        
        $notifications = Notification::where(function($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('role', $user->role);
            })
            ->where('created_at', '>=', now()->subDays(2))
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();
            
        return response()->json($notifications);
    }

    public function markAsRead(Request $request, $id)
    {
        $user = $request->user();
        $notification = Notification::where(function($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('role', $user->role);
            })
            ->where('id', $id)
            ->first();
            
        if (!$notification) {
            return response()->json(['message' => 'Notification non trouvée'], 404);
        }
            
        $notification->update(['is_read' => true]);
        
        return response()->json(['message' => 'Notification marquée comme lue', 'data' => $notification->data]);
    }

    public function markAllAsRead(Request $request)
    {
        $user = $request->user();
        Notification::where(function($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('role', $user->role);
            })
            ->where('created_at', '>=', now()->subDays(2))
            ->where('is_read', false)
            ->update(['is_read' => true]);
            
        return response()->json(['message' => 'Toutes les notifications marquées comme lues']);
    }

    public function unreadCount(Request $request)
    {
        $user = $request->user();
        $count = Notification::where(function($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('role', $user->role);
            })
            ->where('created_at', '>=', now()->subDays(2))
            ->where('is_read', false)
            ->count();
            
        return response()->json(['count' => $count]);
    }
}
