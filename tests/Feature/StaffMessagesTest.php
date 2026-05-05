<?php

namespace Tests\Feature;

use App\Models\StaffMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StaffMessagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_target_message_to_a_specific_role(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $doctor = User::factory()->create(['role' => 'medecin']);
        $cashier = User::factory()->create(['role' => 'caisse']);

        Sanctum::actingAs($admin);

        $this->postJson('/api/admin/broadcast', [
            'subject' => 'Urgence labo',
            'message' => 'Résultats critiques à vérifier immédiatement.',
            'target_role' => 'medecin',
            'priority' => 'urgent',
        ])->assertOk();

        Sanctum::actingAs($doctor);
        $this->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.0.subject', 'Urgence labo')
            ->assertJsonPath('data.0.target_role', 'medecin')
            ->assertJsonPath('data.0.priority', 'urgent');

        Sanctum::actingAs($cashier);
        $this->getJson('/api/messages')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_user_can_mark_staff_message_as_read(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $nurse = User::factory()->create(['role' => 'soins']);

        $message = StaffMessage::create([
            'sender_id' => $admin->id,
            'target_role' => 'soins',
            'subject' => 'Consigne',
            'message' => 'Merci de confirmer la lecture.',
            'priority' => 'important',
        ]);

        Sanctum::actingAs($nurse);

        $this->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('meta.unread_count', 1)
            ->assertJsonPath('data.0.is_read_by_me', false);

        $this->postJson("/api/messages/{$message->id}/read")
            ->assertOk();

        $this->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('meta.unread_count', 0)
            ->assertJsonPath('data.0.is_read_by_me', true);
    }
}
