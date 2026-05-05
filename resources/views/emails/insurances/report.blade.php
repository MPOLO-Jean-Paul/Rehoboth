<x-mail::message>
# Rapport Mensuel des Prestations

Bonjour **{{ $insurance->name }}**,

Veuillez trouver ci-dessous le relevé détaillé des prestations médicales effectuées à la **Polyclique** pour le mois de **{{ $month }}**.

<x-mail::table>
| Date | Patient | Code Adhérent | Service | Montant |
| :--- | :--- | :--- | :--- | :--- |
@foreach($invoices as $inv)
| {{ $inv->updated_at->format('d/m/Y') }} | {{ $inv->patient->first_name }} {{ $inv->patient->last_name }} | {{ $inv->patient->insurance_code }} | {{ $inv->service }} | {{ number_format($inv->amount, 0, ',', ' ') }} FC |
@endforeach
</x-mail::table>

**Total des prestations : {{ number_format($invoices->sum('amount'), 0, ',', ' ') }} FC**

---

Merci pour votre collaboration continue.

Cordialement,<br>
L'administration de la **Polyclique**
</x-mail::message>
