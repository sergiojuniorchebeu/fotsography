<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('studio_settings', function (Blueprint $table) {
            $table->id();
            $table->string('studio_name')->default('Fotsography Studio');
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('niu_rccm')->nullable();
            $table->string('logo_path')->nullable();
            $table->string('receipt_prefix')->default('FST');
            $table->unsignedTinyInteger('plan_advance_pct')->default(30);
            $table->unsignedTinyInteger('plan_intermediate_pct')->default(50);
            $table->unsignedTinyInteger('plan_balance_pct')->default(20);
            $table->unsignedSmallInteger('task_delivery_offset_days')->default(5);
            $table->boolean('penalties_enabled')->default(true);
            $table->unsignedBigInteger('penalty_amount')->default(10000);
            $table->unsignedSmallInteger('penalty_interval_days')->default(2);
            $table->timestamps();
        });

        Schema::create('sequences', function (Blueprint $table) {
            $table->id();
            $table->string('key');
            $table->unsignedSmallInteger('year');
            $table->unsignedBigInteger('value')->default(0);
            $table->unique(['key', 'year']);
        });

        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained();
            $table->string('name');
            $table->string('location')->nullable();
            $table->date('event_date')->nullable();
            $table->date('delivery_date');
            $table->unsignedBigInteger('total_amount')->default(0);
            $table->unsignedTinyInteger('advance_pct')->default(30);
            $table->unsignedTinyInteger('intermediate_pct')->default(50);
            $table->unsignedTinyInteger('balance_pct')->default(20);
            $table->text('notes')->nullable();
            $table->string('status')->default('draft');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_id')->constrained();
            $table->foreignId('project_id')->constrained();
            $table->string('name');
            $table->text('instructions')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_date');
            $table->unsignedBigInteger('client_share')->default(0);
            $table->unsignedBigInteger('member_fee')->default(0);
            $table->string('status')->default('todo');
            $table->string('proof_url')->nullable();
            $table->text('proof_note')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            // Penalty clock (see PenaltyService)
            $table->unsignedInteger('penalty_periods')->default(0);
            $table->unsignedInteger('penalty_base')->default(0);
            $table->date('penalty_anchor')->nullable();
            $table->boolean('penalty_immediate')->default(true);
            // Notification flags
            $table->timestamp('reminded_at')->nullable();
            $table->timestamp('overdue_notified_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'due_date']);
        });

        Schema::create('task_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action'); // submitted, validated, returned
            $table->string('proof_url')->nullable();
            $table->text('comment')->nullable();
            $table->text('corrections')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('client_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained();
            $table->foreignId('client_id')->constrained();
            $table->string('type'); // advance, intermediate, balance, free
            $table->unsignedBigInteger('amount');
            $table->string('method'); // cash, mobile_money, transfer
            $table->string('reference')->nullable();
            $table->text('note')->nullable();
            $table->string('receipt_number')->unique();
            $table->timestamp('paid_at');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->unique()->constrained();
            $table->string('number')->unique();
            $table->unsignedBigInteger('amount');
            $table->timestamp('issued_at');
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_id')->constrained();
            $table->foreignId('project_id')->constrained();
            $table->string('description');
            $table->string('supplier')->nullable();
            $table->unsignedBigInteger('amount');
            $table->date('spent_at');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('member_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained();
            $table->foreignId('project_id')->constrained();
            $table->foreignId('user_id')->constrained();
            $table->unsignedBigInteger('gross_amount');
            $table->unsignedBigInteger('penalty_deducted')->default(0);
            $table->unsignedBigInteger('net_amount');
            $table->string('method');
            $table->string('reference')->nullable();
            $table->text('note')->nullable();
            $table->string('receipt_number')->unique();
            $table->timestamp('paid_at');
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('penalties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained();
            $table->foreignId('user_id')->constrained();
            $table->unsignedInteger('period');
            $table->unsignedBigInteger('amount');
            $table->unsignedInteger('days_late');
            $table->timestamp('accrued_at');
            $table->unique(['task_id', 'period']);
        });

        Schema::create('penalty_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->string('type'); // withheld, direct
            $table->unsignedBigInteger('amount');
            $table->foreignId('member_payment_id')->nullable()->constrained()->nullOnDelete();
            $table->string('method')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('collected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('settled_at');
            $table->timestamps();
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action'); // created, updated, deleted, payment, ...
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('description');
            $table->json('properties')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        foreach (['activity_logs', 'penalty_settlements', 'penalties', 'member_payments', 'expenses', 'invoices', 'client_payments', 'task_reviews', 'tasks', 'activities', 'projects', 'clients', 'sequences', 'studio_settings'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
