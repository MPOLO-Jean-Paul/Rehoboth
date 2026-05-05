<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\IdempotencyRecord;
use App\Models\Patient;
use App\Models\StaffMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OperationalHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_idempotency_key_prevents_duplicate_mutations(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $payload = [
            'subject' => 'Réunion de garde',
            'message' => 'Briefing obligatoire dans 10 minutes.',
            'priority' => 'important',
        ];

        $this->withHeader('Idempotency-Key', 'same-network-action')
            ->postJson('/api/admin/broadcast', $payload)
            ->assertOk();

        $this->withHeader('Idempotency-Key', 'same-network-action')
            ->postJson('/api/admin/broadcast', $payload)
            ->assertOk();

        $this->assertSame(1, StaffMessage::count());
        $this->assertSame(1, IdempotencyRecord::count());
    }

    public function test_mutating_authenticated_requests_are_audited(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->withHeader('Idempotency-Key', 'audit-action')
            ->postJson('/api/admin/broadcast', [
                'subject' => 'Consigne',
                'message' => 'Contrôle des transmissions.',
                'priority' => 'normal',
            ])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'user_role' => 'admin',
            'method' => 'POST',
            'path' => '/api/admin/broadcast',
            'status_code' => 200,
        ]);

        $this->assertSame('Consigne', AuditLog::first()->payload['subject']);
    }

    public function test_sensitive_read_requests_are_audited_without_medical_payload(): void
    {
        $nurse = User::factory()->create(['role' => 'soins']);
        Patient::create([
            'first_name' => 'Marie',
            'last_name' => 'Kabongo',
            'contact_info' => '+243800000001',
            'complaints' => 'Douleur thoracique',
        ]);

        Sanctum::actingAs($nurse);

        $this->getJson('/api/patients?q=Marie')
            ->assertOk();

        $audit = AuditLog::query()
            ->where('method', 'GET')
            ->where('path', '/api/patients')
            ->firstOrFail();

        $this->assertTrue($audit->payload['read_audit']);
        $this->assertSame('Marie', $audit->payload['query']['q']);
        $this->assertStringNotContainsString('Douleur thoracique', json_encode($audit->payload));
    }

    public function test_mutation_audit_redacts_medical_fields(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->withHeader('Idempotency-Key', 'redacted-patient-create')
            ->postJson('/api/patients', [
                'first_name' => 'Paul',
                'last_name' => 'Ilunga',
                'contact_info' => '+243800000002',
                'complaints' => 'Suspicion paludisme severe',
                'consultation_fee' => 0,
            ])
            ->assertCreated();

        $audit = AuditLog::query()
            ->where('method', 'POST')
            ->where('path', '/api/patients')
            ->firstOrFail();

        $this->assertSame('[REDACTED]', $audit->payload['contact_info']);
        $this->assertSame('[REDACTED]', $audit->payload['complaints']);
        $this->assertSame('Paul', $audit->payload['first_name']);
    }

    public function test_reusing_idempotency_key_for_another_action_is_rejected(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->withHeader('Idempotency-Key', 'shared-key')
            ->postJson('/api/admin/broadcast', [
                'subject' => 'Consigne',
                'message' => 'Premiere action.',
                'priority' => 'normal',
            ])
            ->assertOk();

        $this->withHeader('Idempotency-Key', 'shared-key')
            ->postJson('/api/admin/users', [
                'name' => 'Nouvel Agent',
                'email' => 'agent@example.test',
                'password' => 'password-long',
                'role' => 'reception',
            ])
            ->assertStatus(409);
    }
}
