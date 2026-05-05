<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Medicine;
use App\Models\Patient;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_reception_can_create_patient_visit_and_invoice(): void
    {
        $user = User::factory()->create([
            'role' => 'reception',
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/patients', [
            'first_name' => 'Jean',
            'last_name' => 'Mukendi',
            'contact_info' => '+243800000000',
            'complaints' => 'Fièvre',
            'consultation_fee' => 7500,
        ]);

        $response->assertCreated()
            ->assertJsonPath('patient.first_name', 'Jean')
            ->assertJsonPath('visit.current_service', 'caisse')
            ->assertJsonPath('invoice.amount', 12500);

        $this->assertDatabaseHas('patients', [
            'first_name' => 'Jean',
            'last_name' => 'Mukendi',
        ]);

        $this->assertDatabaseHas('visits', [
            'current_service' => 'caisse',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('invoices', [
            'amount' => 12500,
            'status' => 'unpaid',
        ]);
    }

    public function test_non_admin_cannot_access_admin_dashboard(): void
    {
        $user = User::factory()->create([
            'role' => 'reception',
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/admin/dashboard')
            ->assertForbidden();
    }

    public function test_soins_can_access_visit_queue_and_forward_a_visit(): void
    {
        $user = User::factory()->create([
            'role' => 'soins',
        ]);

        $patient = Patient::create([
            'first_name' => 'Mireille',
            'last_name' => 'K.',
        ]);

        $visit = Visit::create([
            'patient_id' => $patient->id,
            'current_service' => 'soins',
            'status' => 'pending',
            'complaints_notes' => '',
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/visits')
            ->assertOk()
            ->assertJsonCount(1);

        $this->postJson("/api/visits/{$visit->id}/forward", [
            'next_service' => 'medecin',
            'notes' => 'Constantes prises et patient orienté.',
        ])->assertOk();

        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'current_service' => 'medecin',
        ]);
    }

    public function test_doctor_forward_to_labo_creates_invoice_and_cashier_can_retrieve_it(): void
    {
        $doctor = User::factory()->create(['role' => 'medecin']);
        $cashier = User::factory()->create(['role' => 'caisse']);

        $patient = Patient::create([
            'first_name' => 'Patrick',
            'last_name' => 'M.',
        ]);

        $visit = Visit::create([
            'patient_id' => $patient->id,
            'current_service' => 'medecin',
            'status' => 'pending',
            'complaints_notes' => '',
            'doctor_id' => $doctor->id,
        ]);

        Sanctum::actingAs($doctor);

        $response = $this->postJson("/api/visits/{$visit->id}/forward", [
            'next_service' => 'labo',
            'lab_tests' => [
                ['code' => 'NFS'],
                ['code' => 'GLY'],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('visit.current_service', 'labo')
            ->assertJsonPath('visit.invoice.service', 'labo')
            ->assertJsonPath('visit.invoice.amount', 20000);

        $invoice = Invoice::where('visit_id', $visit->id)
            ->where('service', 'labo')
            ->firstOrFail();

        $this->assertSame(20000.0, (float) $invoice->amount);

        Sanctum::actingAs($cashier);

        $this->getJson('/api/invoices')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $invoice->id,
                'service' => 'labo',
                'amount' => 20000,
            ]);
    }

    public function test_doctor_forward_to_pharmacy_creates_invoice_from_medicine_price(): void
    {
        $doctor = User::factory()->create(['role' => 'medecin']);

        $patient = Patient::create([
            'first_name' => 'Sarah',
            'last_name' => 'L.',
        ]);

        $visit = Visit::create([
            'patient_id' => $patient->id,
            'current_service' => 'medecin',
            'status' => 'pending',
            'complaints_notes' => '',
            'doctor_id' => $doctor->id,
        ]);

        $medicine = Medicine::create([
            'name' => 'Amoxicilline',
            'stock_quantity' => 10,
            'low_stock_threshold' => 2,
            'price' => 2500,
        ]);

        Sanctum::actingAs($doctor);

        $response = $this->postJson("/api/visits/{$visit->id}/forward", [
            'next_service' => 'pharmacie',
            'prescription_items' => [
                [
                    'medicine_id' => $medicine->id,
                    'name' => $medicine->name,
                    'quantity' => 2,
                    'dosage' => '500mg',
                ],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('visit.current_service', 'pharmacie')
            ->assertJsonPath('visit.invoice.service', 'pharmacie')
            ->assertJsonPath('visit.invoice.amount', 5000);

        $this->assertDatabaseHas('medicines', [
            'id' => $medicine->id,
            'stock_quantity' => 8,
        ]);

        $this->assertDatabaseHas('prescription_items', [
            'medicine_id' => $medicine->id,
            'status' => 'pending',
            'quantity_prescribed' => 2,
        ]);
    }

    public function test_soins_transfer_to_pharmacy_creates_invoice_from_medicine_price(): void
    {
        $nurse = User::factory()->create(['role' => 'soins']);

        $patient = Patient::create([
            'first_name' => 'Grace',
            'last_name' => 'B.',
        ]);

        $visit = Visit::create([
            'patient_id' => $patient->id,
            'current_service' => 'soins',
            'status' => 'pending',
            'complaints_notes' => '',
        ]);

        $medicine = Medicine::create([
            'name' => 'Ibuprofene',
            'stock_quantity' => 6,
            'low_stock_threshold' => 2,
            'price' => 1500,
        ]);

        Sanctum::actingAs($nurse);

        $response = $this->postJson('/api/soins/transfer', [
            'visit_id' => $visit->id,
            'next_service' => 'pharmacie',
            'notes' => 'Prescription transmise après soins.',
            'prescription_items' => [
                [
                    'medicine_id' => $medicine->id,
                    'name' => $medicine->name,
                    'quantity' => 3,
                ],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('visit.current_service', 'pharmacie')
            ->assertJsonPath('visit.invoice.service', 'pharmacie')
            ->assertJsonPath('visit.invoice.amount', 4500);

        $this->assertDatabaseHas('medicines', [
            'id' => $medicine->id,
            'stock_quantity' => 3,
        ]);
    }

    public function test_pharmacy_dispense_requires_items_and_closes_visit(): void
    {
        $user = User::factory()->create([
            'role' => 'pharmacie',
        ]);

        $patient = Patient::create([
            'first_name' => 'Aline',
            'last_name' => 'K.',
        ]);

        $visit = Visit::create([
            'patient_id' => $patient->id,
            'current_service' => 'pharmacie',
            'status' => 'pending',
            'complaints_notes' => '',
        ]);

        $medicine = Medicine::create([
            'name' => 'Paracetamol',
            'stock_quantity' => 20,
            'low_stock_threshold' => 5,
            'price' => 1000,
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson("/api/pharmacy/dispense/{$visit->id}", [
            'items' => [
                [
                    'medicine_id' => $medicine->id,
                    'quantity' => 2,
                ],
            ],
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('medicines', [
            'id' => $medicine->id,
            'stock_quantity' => 18,
        ]);
        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'status' => 'completed',
            'current_service' => 'completed',
        ]);
    }
}
