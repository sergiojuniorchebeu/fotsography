<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ClientPaymentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\EarningsController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\FinanceController;
use App\Http\Controllers\MemberPaymentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PenaltyController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectTemplateController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TeamController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
    Route::post('/register', [AuthController::class, 'register']);
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/password/change', [AuthController::class, 'showChangePassword'])->name('password.change');
    Route::put('/password/change', [AuthController::class, 'changePassword'])->name('password.change.update');
});

Route::middleware(['auth', 'ready'])->group(function () {
    Route::get('/', DashboardController::class)->name('dashboard');

    // Notifications & push
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/recent', [NotificationController::class, 'recent']);
    Route::get('/notifications/{id}/open', [NotificationController::class, 'open']);
    Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);
    Route::post('/push/subscribe', [NotificationController::class, 'subscribe']);
    Route::post('/push/unsubscribe', [NotificationController::class, 'unsubscribe']);

    // Everyone: tasks (scoped in controller), own earnings, own receipts
    Route::get('/tasks', [TaskController::class, 'index']);
    Route::get('/tasks/{task}', [TaskController::class, 'show']);
    Route::post('/tasks/{task}/start', [TaskController::class, 'start']);
    Route::post('/tasks/{task}/submit', [TaskController::class, 'submit']);
    Route::get('/me/earnings', [EarningsController::class, 'index']);
    Route::get('/member-payments/{payment}/receipt', [DocumentController::class, 'memberReceipt']);
    Route::get('/penalty-refunds/{refund}/receipt', [DocumentController::class, 'refundReceipt']);

    // Admin + assistant: organise the work, penalties
    Route::middleware('role:admin,assistant')->group(function () {
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::get('/projects/{project}', [ProjectController::class, 'show']);
        Route::post('/projects/{project}/activities', [ActivityController::class, 'store']);
        Route::put('/activities/{activity}', [ActivityController::class, 'update']);
        Route::delete('/activities/{activity}', [ActivityController::class, 'destroy']);
        Route::post('/activities/{activity}/tasks', [TaskController::class, 'store']);
        Route::post('/projects/{project}/tasks', [TaskController::class, 'storeInProject']);
        Route::post('/projects/{project}/apply-template', [ProjectTemplateController::class, 'apply']);
        Route::put('/tasks/{task}', [TaskController::class, 'update']);
        Route::delete('/tasks/{task}', [TaskController::class, 'destroy']);
        Route::get('/penalties', [PenaltyController::class, 'index']);
        Route::post('/penalties/collect', [PenaltyController::class, 'collect']);
    });

    // Admin only
    Route::middleware('role:admin')->group(function () {
        Route::get('/clients', [ClientController::class, 'index']);
        Route::get('/clients/{client}', [ClientController::class, 'show']);
        Route::post('/clients', [ClientController::class, 'store']);
        Route::put('/clients/{client}', [ClientController::class, 'update']);
        Route::delete('/clients/{client}', [ClientController::class, 'destroy']);

        Route::post('/projects', [ProjectController::class, 'store']);
        Route::put('/projects/{project}', [ProjectController::class, 'update']);
        Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);
        Route::post('/projects/{project}/payments', [ClientPaymentController::class, 'store']);

        Route::post('/activities/{activity}/expenses', [ExpenseController::class, 'store']);
        Route::put('/expenses/{expense}', [ExpenseController::class, 'update']);
        Route::delete('/expenses/{expense}', [ExpenseController::class, 'destroy']);

        Route::post('/tasks/{task}/validate', [TaskController::class, 'validateTask']);
        Route::post('/tasks/{task}/return', [TaskController::class, 'returnTask']);
        Route::post('/tasks/{task}/payments', [MemberPaymentController::class, 'store']);
        Route::post('/penalties/cancel', [PenaltyController::class, 'cancel']);

        Route::get('/client-payments/{payment}/receipt', [DocumentController::class, 'clientReceipt']);
        Route::get('/invoices/{invoice}/pdf', [DocumentController::class, 'invoice']);

        Route::get('/finances', [FinanceController::class, 'index']);
        Route::get('/finances/export/{type}', [FinanceController::class, 'export']);

        Route::get('/team', [TeamController::class, 'index']);
        Route::post('/team', [TeamController::class, 'store']);
        Route::put('/team/{user}', [TeamController::class, 'update']);
        Route::post('/team/{user}/toggle', [TeamController::class, 'toggle']);
        Route::post('/team/{user}/reset-password', [TeamController::class, 'resetPassword']);
        Route::post('/team/{user}/send-access', [TeamController::class, 'sendAccess'])->middleware('throttle:10,1');

        Route::get('/templates', [ProjectTemplateController::class, 'index']);
        Route::post('/templates', [ProjectTemplateController::class, 'store']);
        Route::put('/templates/{template}', [ProjectTemplateController::class, 'update']);
        Route::delete('/templates/{template}', [ProjectTemplateController::class, 'destroy']);
        Route::put('/projects/{project}/invoice-lines', [ProjectController::class, 'invoiceLines']);
        Route::post('/projects/{project}/save-as-template', [ProjectTemplateController::class, 'fromProject']);

        Route::get('/settings', [SettingsController::class, 'edit']);
        Route::post('/settings', [SettingsController::class, 'update']);

        Route::get('/activity-log', [ActivityLogController::class, 'index']);
    });
});
