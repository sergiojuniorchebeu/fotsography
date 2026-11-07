@php($f = fn ($n) => number_format($n, 0, ',', ' ').' FCFA')
@extends('pdf.layout')
@section('title', 'Reçu de rémunération')
@section('number', $payment->receipt_number)
@section('date', 'Le '.$payment->paid_at->format('d/m/Y à H:i'))
@section('content')
<table style="width: 100%"><tr>
    <td style="width: 50%; vertical-align: top" class="box">
        <div class="muted">Versé à</div>
        <strong>{{ $payment->user->name }}</strong><br>
        {{ $payment->user->role->label() }}@if($payment->user->phone)<br>{{ $payment->user->phone }}@endif
    </td>
    <td style="width: 4%"></td>
    <td style="vertical-align: top" class="box">
        <div class="muted">Pour la tâche</div>
        <strong>{{ $payment->task->name }}</strong><br>
        Projet : {{ $payment->project->name }}
    </td>
</tr></table>

<h3>Détail du versement</h3>
<table class="grid">
    <tr><td>Montant brut</td><td class="r">{{ $f($payment->gross_amount) }}</td></tr>
    <tr><td>Pénalité de retard retenue</td><td class="r">{{ $payment->penalty_deducted ? '− '.$f($payment->penalty_deducted) : '0 FCFA' }}</td></tr>
    <tr class="total"><td>Montant net versé</td><td class="r">{{ $f($payment->net_amount) }}</td></tr>
</table>
<p class="muted" style="margin-top: 10px">Moyen : {{ $payment->method->label() }}@if($payment->reference) · Réf. {{ $payment->reference }}@endif @if($payment->note)<br>{{ $payment->note }}@endif</p>

<table class="stamp"><tr>
    <td>Payé par<br><strong>{{ $paidBy ?? '—' }}</strong><br><br>____________________</td>
    <td class="r">Reçu par<br><strong>{{ $payment->user->name }}</strong><br><br>____________________</td>
</tr></table>
@endsection
