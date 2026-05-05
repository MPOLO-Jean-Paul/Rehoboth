<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Administrateur (Créé automatiquement au déploiement)
        User::create([
            'name' => 'Admin System',
            'email' => 'admin@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);
        
        // Les autres utilisateurs (réception, caisse, etc.) seront 
        // créés dynamiquement par l'Administrateur via son interface.
    }
}
