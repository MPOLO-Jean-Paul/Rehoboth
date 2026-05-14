<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required'
        ]);

        $user = \App\Models\User::where('email', $credentials['email'])->first();

        if ($user && Hash::check($credentials['password'], $user->password)) {
            $abilities = $user->role === 'admin' ? ['*'] : [$user->role];
            $token = $user->createToken('rehoboth-mobile-token', $abilities)->plainTextToken;
            
            return response()->json([
                'user' => $user,
                'token' => $token
            ]);
        }

        \Log::warning('Login failed', ['email' => $credentials['email']]);
        return response()->json(['message' => 'Identifiant ou mot de passe incorrect'], 401);
    }

    public function logout(Request $request)
    {
        $token = $request->user()?->currentAccessToken();

        if ($token) {
            $token->delete();
        }

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function updatePushToken(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
        ]);

        $request->user()->update([
            'expo_push_token' => $request->token,
        ]);

        return response()->json(['message' => 'Push token updated']);
    }

    public function updateProfilePicture(Request $request)
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        $user = $request->user();
        
        if ($request->hasFile('image')) {
            // Delete old picture if exists
            if ($user->profile_picture && Storage::disk('public')->exists($user->profile_picture)) {
                Storage::disk('public')->delete($user->profile_picture);
            }

            $path = $request->file('image')->store('profiles', 'public');
            $user->profile_picture = $path;
            $user->save();

            return response()->json([
                'message' => 'Photo de profil mise à jour',
                'user' => $user->fresh(),
                'url' => route('media.public', ['path' => $path])
            ]);
        }

        return response()->json(['message' => 'Aucune image reçue'], 400);
    }
}
