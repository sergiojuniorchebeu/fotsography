@php($f = fn ($n) => number_format($n, 0, ',', ' ').' FCFA')
@extends('pdf.layout')
@section('title', 'Reçu de remboursement')
@section('number', $refund->receipt_number)
@section('date', 'Le '.$refund->refunded_at->format('d/m/Y à H:i'))
@section('content')
<table style="width: 100%"><tr>
    <td style="width: 50%; vertical-align: top" class="box">
        <div class="muted">Remboursé à</div>
        <strong>{{ $refund->user->name }}</strong><br>
        {{ $refund->user->role->label() }}@if($refund->user->phone)<br>{{ $refund->user->phone }}@endif
    </td>
    <td style="width: 4%"></td>
    <td style="vertical-align: top" class="box">
        <div class="muted">Objet</div>
        <strong>Pénalités de retard annulées</strong><br>
        @if($refund->task)Tâche : {{ $refund->task->name }}<br>@endif
        @if($refund->project)Projet : {{ $refund->project->name }}@endif
    </td>
</tr></table>

<h3>Détail</h3>
<table class="grid">
    <tr><td>Motif de l'annulation</td><td>{{ $refund->reason }}</td></tr>
    <tr><td>Moyen</td><td>{{ $refund->method->label() }}@if($refund->reference) · Réf. {{ $refund->reference }}@endif</td></tr>
    <tr class="total"><td>Montant remboursé</td><td class="r">{{ $f($refund->amount) }}</td></tr>
</table>
<p class="muted" style="margin-top: 10px">Ce montant avait déjà été réglé par le membre (retenue sur un versement ou paiement direct) avant l'annulation des pénalités.</p>

<table class="stamp"><tr>
    <td>Remboursé par<br><strong>{{ $refundedBy ?? '—' }}</strong><br><br>____________________</td>
    <td class="r">Reçu par<br><strong>{{ $refund->user->name }}</strong><br><br>____________________</td>
</tr></table>
@endsection
