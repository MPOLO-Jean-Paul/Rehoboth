<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\HospitalizationController;
use App\Http\Controllers\InsuranceController;
use App\Http\Controllers\NursingReportController;
use App\Http\Controllers\LaboController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\PharmacyController;
use App\Http\Controllers\VisitController;
use App\Http\Controllers\NotificationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['message' => 'Bienvenue sur l\'API REHOBOTH', 'version' => '1.0']));
Route::get('/health', fn () => response()->json(['status' => 'ok']));

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
    Route::post('/user/profile-picture', [AuthController::class, 'updateProfilePicture']);
    Route::post('/user/push-token', [AuthController::class, 'updatePushToken']);
    
    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/all', [NotificationController::class, 'destroyAll']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    // Shared Messages
    Route::get('/messages', [AdminController::class, 'getMessages']);
    Route::post('/messages/{id}/read', [AdminController::class, 'markMessageAsRead']);
    Route::post('/messages/read-all', [AdminController::class, 'markAllMessagesAsRead']);
    Route::delete('/messages/{id}', [AdminController::class, 'deleteMessage']);

});

Route::middleware(['auth:sanctum', 'role:admin,reception,soins'])->group(function () {
    Route::get('/patients', [PatientController::class, 'index']);
    Route::post('/patients', [PatientController::class, 'store']);
    Route::get('/reception/stats-today', [PatientController::class, 'statsToday']);
    Route::get('/reception/cash-today', [AdminController::class, 'getCashToday']);
    // Route::get('/insurances', ...) moved to shared block
    Route::get('/insurances/verify', [PatientController::class, 'verifyInsurance']);
    Route::post('/reception/catalog/add', [PatientController::class, 'addCatalogItem']);
});

Route::middleware(['auth:sanctum', 'role:admin,reception,soins,caisse'])->group(function () {
    Route::get('/insurances', [App\Http\Controllers\InsuranceController::class, 'index']);
});

Route::middleware(['auth:sanctum', 'role:admin,caisse,medecin,labo,pharmacie,soins'])->group(function () {
    // Workflow
    Route::get('/visits', [VisitController::class, 'index']);
    Route::get('/visits/my-today', [VisitController::class, 'myToday']);
    Route::get('/soins/patients', [VisitController::class, 'soinsPatients']);
    Route::post('/soins/transfer', [VisitController::class, 'transfer']);
    Route::get('/workflow/catalog', [VisitController::class, 'workflowCatalog']);
    Route::get('/doctors', [VisitController::class, 'getDoctors']);
});

Route::middleware(['auth:sanctum', 'role:admin,medecin,labo,soins'])->group(function () {
    Route::post('/visits/{id}/forward', [VisitController::class, 'forward']); // Move to next service
});

// Hospitalisation
Route::middleware(['auth:sanctum', 'role:admin,soins,medecin'])->group(function () {
    Route::get('/hospitalizations', [HospitalizationController::class, 'index']);
    Route::post('/hospitalizations', [HospitalizationController::class, 'admit']);
    Route::put('/hospitalizations/{id}', [HospitalizationController::class, 'update']);
    Route::post('/hospitalizations/{id}/discharge', [HospitalizationController::class, 'discharge']);
    Route::post('/hospitalizations/bill-daily', [HospitalizationController::class, 'billDaily']);
    Route::get('/hospitalizations/stats', [HospitalizationController::class, 'stats']);
});

// Rapports de Garde & Alertes
Route::middleware(['auth:sanctum', 'role:admin,soins'])->group(function () {
    Route::get('/nursing/reports', [NursingReportController::class, 'index']);
    Route::post('/nursing/reports', [NursingReportController::class, 'store']);
    Route::put('/nursing/reports/{id}', [NursingReportController::class, 'update']);
    Route::get('/nursing/alerts', [NursingReportController::class, 'getAlerts']);
    Route::post('/nursing/alerts/mark-checked/{id}', [NursingReportController::class, 'markChecked']);
    Route::post('/nursing/alerts/trigger/{id}', [NursingReportController::class, 'triggerAlert']);
    Route::get('/nursing/today-stats', [NursingReportController::class, 'todayStats']);
    Route::get('/soins/stats', [NursingReportController::class, 'soinsStats']);
});

Route::middleware(['auth:sanctum', 'role:admin,caisse'])->group(function () {
    // Caisse
    Route::get('/invoices', [InvoiceController::class, 'index']);
    Route::get('/invoices/{id}/check-insurance-status', [InvoiceController::class, 'checkInsuranceStatus']);
    Route::post('/invoices/{id}/pay', [InvoiceController::class, 'pay']);
    Route::get('/cashier/daily-summary', [InvoiceController::class, 'getDailySummary']);
    Route::get('/cashier/history', [InvoiceController::class, 'getHistory']);
    Route::get('/cashier/accounting/stats', [InvoiceController::class, 'getAccountingStats']);
    Route::get('/cashier/accounting/journals', [InvoiceController::class, 'getJournals']);
    Route::post('/cashier/accounting/close', [InvoiceController::class, 'closeSession']);
    Route::post('/cashier/accounting/journals', [InvoiceController::class, 'storeJournal']);
    Route::get('/cashier/accounting/export', [InvoiceController::class, 'exportAccountingData']);
    Route::get('/cashier/accounting/auto-settings', [InvoiceController::class, 'getAutoJournalSettings']);
    Route::post('/cashier/accounting/auto-settings', [InvoiceController::class, 'updateAutoJournalSettings']);
    Route::get('/cashier/accounting/journals/{id}', [InvoiceController::class, 'getJournalDetails']);

    // Insurances & Reports
    // Route::get('/insurances', [InsuranceController::class, 'index']); // Moved to shared block
    Route::get('/insurances/{id}/report', [InsuranceController::class, 'getMonthlyReport']);
    Route::post('/insurances/{id}/settle', [InsuranceController::class, 'settleInvoices']);
    Route::post('/insurances/{id}/send-report', [InsuranceController::class, 'sendMonthlyReport']);
});

Route::middleware(['auth:sanctum', 'role:admin,labo'])->group(function () {
    // Labo
    Route::get('/labo/prescriptions', [LaboController::class, 'getPendingOrders']);
    Route::post('/labo/results/{id}', [LaboController::class, 'updateResults']);
    Route::get('/labo/completed-today', [LaboController::class, 'completedToday']);
    Route::get('/labo/history', [LaboController::class, 'allHistory']);
});

Route::middleware(['auth:sanctum', 'role:admin,pharmacie,soins'])->group(function () {
    // Pharmacy
    Route::get('/pharmacy/prescriptions', [PharmacyController::class, 'getPendingPrescriptions']);
    Route::get('/pharmacy/medicines', [PharmacyController::class, 'indexMedicines']);
    Route::post('/pharmacy/medicines', [PharmacyController::class, 'createMedicine']);
    Route::post('/pharmacy/stock', [PharmacyController::class, 'addStock']);
    Route::post('/pharmacy/dispense/{visitId}', [PharmacyController::class, 'dispense']);
    Route::get('/pharmacy/expiry', [PharmacyController::class, 'expiryStatus']);
    Route::get('/pharmacy/dispensed-today', [PharmacyController::class, 'dispensedToday']);
    Route::post('/pharmacy/report-problem', [PharmacyController::class, 'reportProblem']);
    Route::post('/pharmacy/report/daily', [PharmacyController::class, 'sendDailyReport']);
    Route::get('/pharmacy/sales', [PharmacyController::class, 'salesReport']);
    Route::get('/pharmacy/inventory-insights', [PharmacyController::class, 'inventoryInsights']);
    Route::post('/pharmacy/cancel/{visitId}', [PharmacyController::class, 'cancelPrescription']);
});

Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    // Admin
    Route::get('/admin/bootstrap', [AdminController::class, 'getBootstrap']);
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);
    Route::post('/admin/users', [AdminController::class, 'createUser']);
    Route::get('/admin/users', [AdminController::class, 'getUsers']);
    Route::put('/admin/users/{id}', [AdminController::class, 'updateUser']);
    Route::post('/admin/users/{id}/reset-password', [AdminController::class, 'resetPassword']);
    Route::delete('/admin/users/{id}', [AdminController::class, 'deleteUser']);
    Route::post('/admin/broadcast', [AdminController::class, 'broadcastMail']);
    Route::put('/admin/messages/{id}', [AdminController::class, 'updateMessage']);

    // New real-data routes
    Route::get('/admin/diseases', [AdminController::class, 'getDiseases']);
    Route::get('/admin/stock-expiry', [AdminController::class, 'getStockExpiry']);
    Route::get('/admin/cash-today', [AdminController::class, 'getCashToday']);
    // Insurance Management
    Route::get('/admin/insurances', [AdminController::class, 'getInsurances']);
    Route::post('/admin/insurances', [AdminController::class, 'createInsurance']);
    Route::put('/admin/insurances/{id}', [AdminController::class, 'updateInsurance']);
    Route::delete('/admin/insurances/{id}', [AdminController::class, 'deleteInsurance']);
    Route::get('/admin/insurances/{id}/members', [AdminController::class, 'getInsuredMembers']);
    Route::post('/admin/insurances/members', [AdminController::class, 'addInsuredMember']);
    Route::put('/admin/insurances/members/{id}', [AdminController::class, 'updateInsuredMember']);
    Route::delete('/admin/insurances/members/{id}', [AdminController::class, 'deleteInsuredMember']);
    
    // Settings
    Route::get('/admin/settings', [AdminController::class, 'getSettings']);
    Route::post('/admin/settings', [AdminController::class, 'updateSetting']);
    Route::post('/admin/settings/bulk', [AdminController::class, 'updateSettingsBulk']);
});
