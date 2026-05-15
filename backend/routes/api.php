<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\LaboController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\PharmacyController;
use App\Http\Controllers\VisitController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    try {
        \DB::connection()->getPdo();
        return response()->json([
            'status' => 'ok',
            'database' => 'CONNECTED',
            'database_name' => \DB::connection()->getDatabaseName()
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'database' => 'DISCONNECTED',
            'error' => $e->getMessage()
        ], 500);
    }
});

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
});

Route::middleware(['auth:sanctum', 'role:admin,reception'])->group(function () {
    Route::get('/patients', [PatientController::class, 'index']);
    Route::post('/patients', [PatientController::class, 'store']);
    Route::get('/reception/cash-today', [PatientController::class, 'cashToday']);
    Route::get('/reception/stats-today', [PatientController::class, 'statsToday']);
    Route::get('/insurances', [PatientController::class, 'getInsurances']);
});

Route::middleware(['auth:sanctum', 'role:admin,caisse,medecin,labo,pharmacie,soins'])->group(function () {
    // Workflow
    Route::get('/visits', [VisitController::class, 'index']);
    Route::get('/visits/my-today', [VisitController::class, 'myToday']);
    Route::get('/workflow/catalog', [AdminController::class, 'getCatalog']);
});

Route::middleware(['auth:sanctum', 'role:admin,medecin,labo,soins'])->group(function () {
    Route::post('/visits/{id}/forward', [VisitController::class, 'forward']); // Move to next service
});

Route::middleware(['auth:sanctum', 'role:admin,caisse'])->group(function () {
    // Caisse
    Route::get('/invoices', [InvoiceController::class, 'index']);
    Route::post('/invoices/{id}/pay', [InvoiceController::class, 'pay']);
});

Route::middleware(['auth:sanctum', 'role:admin,labo'])->group(function () {
    // Labo
    Route::post('/labo/results/{id}', [LaboController::class, 'updateResults']);
});

Route::middleware(['auth:sanctum', 'role:admin,pharmacie,medecin'])->group(function () {
    // Pharmacy
    Route::get('/pharmacy/medicines', [PharmacyController::class, 'indexMedicines']);
    Route::get('/pharmacy/prescriptions', [PharmacyController::class, 'prescriptions']);
    Route::get('/pharmacy/inventory-insights', [PharmacyController::class, 'inventoryInsights']);
    Route::get('/pharmacy/delivery-history', [PharmacyController::class, 'deliveryHistory']);
    Route::get('/pharmacy/sales', [PharmacyController::class, 'sales']);
    Route::get('/pharmacy/dispensed-today', [PharmacyController::class, 'dispensedToday']);
    Route::post('/pharmacy/medicines', [PharmacyController::class, 'createMedicine']);
    Route::post('/pharmacy/stock/add', [PharmacyController::class, 'addStock']);
    Route::post('/pharmacy/dispense/{visitId}', [PharmacyController::class, 'dispense']);
});

Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    // Admin
    Route::get('/admin/bootstrap', [AdminController::class, 'bootstrap']);
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);
    Route::post('/admin/users', [AdminController::class, 'createUser']);
    Route::get('/admin/users', [AdminController::class, 'getUsers']);
    Route::put('/admin/users/{id}', [AdminController::class, 'updateUser']);
    Route::delete('/admin/users/{id}', [AdminController::class, 'deleteUser']);
    Route::get('/admin/messages', [AdminController::class, 'getMessages']);
    Route::post('/admin/broadcast', [AdminController::class, 'broadcastMail']);
    Route::get('/admin/patient-records', [AdminController::class, 'fetchDataRecords']);
});
