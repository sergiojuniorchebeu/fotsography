<x-mail::message>
# Bonjour {{ $user->name }},

@if ($isNew)
Votre compte **{{ $studio }}** est prêt. Vous y trouverez vos tâches, vos dates de livraison et vos gains.
@else
Votre mot de passe **{{ $studio }}** a été réinitialisé par l'administrateur.
@endif

<x-mail::panel>
**Identifiant :** {{ $user->email }} (ou « {{ $user->name }} »)<br>
**Mot de passe provisoire :** `{{ $password }}`
</x-mail::panel>

<x-mail::button :url="$loginUrl">
Me connecter
</x-mail::button>

À la première connexion, vous choisirez votre propre mot de passe.

Si vous n'attendiez pas cet email, prévenez l'administrateur du studio.

{{ $studio }}
</x-mail::message>
