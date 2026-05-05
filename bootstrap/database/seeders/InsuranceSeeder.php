<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class InsuranceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $mery = \App\Models\Insurance::create([
            'name' => 'Mery Insurance',
            'contract_date' => '2024-01-01',
            'monthly_flat_fee' => 50000.00
        ]);

        $assur = \App\Models\Insurance::create([
            'name' => 'AssurAll',
            'contract_date' => '2024-02-15',
            'monthly_flat_fee' => 75000.00
        ]);

        // Ajouter des membres valides
        \App\Models\InsuredMember::create([
            'insurance_id' => $mery->id,
            'member_name' => 'Patient Test Mery',
            'membership_code' => 'MERY-123',
            'is_active' => true
        ]);

        \App\Models\InsuredMember::create([
            'insurance_id' => $assur->id,
            'member_name' => 'Patient Test Assur',
            'membership_code' => 'ASSUR-456',
            'is_active' => true
        ]);
    }
}
