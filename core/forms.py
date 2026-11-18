from decimal import Decimal
from django import forms
from django.utils import timezone
from .models import Workshop, Session, Customer

class LocalDateTime(forms.DateTimeInput):
    input_type = 'datetime-local'
    def __init__(self, **kwargs): super().__init__(format='%Y-%m-%dT%H:%M', **kwargs)

class WorkshopForm(forms.ModelForm):
    class Meta:
        model = Workshop
        fields = ['title','location','payment_hours','notes']
        labels = {'title':'Nom del taller','location':'Ubicació','payment_hours':'Termini de la senyal (hores)','notes':'Notes'}
        widgets = {'notes':forms.Textarea(attrs={'rows':3})}
    def clean_payment_hours(self):
        n = self.cleaned_data['payment_hours']
        if n < 1: raise forms.ValidationError('El termini ha de ser positiu.')
        return n

class SessionForm(forms.ModelForm):
    class Meta:
        model = Session
        fields = ['starts_at','capacity','price','deposit']
        labels = {'starts_at':'Data i hora de la sessió','capacity':'Aforament','price':'Preu per persona (€)','deposit':'Senyal per persona (€)'}
        widgets = {'starts_at':LocalDateTime()}

    def clean(self):
        data = super().clean()
        if data.get('capacity') is not None and data['capacity'] < 1:
            self.add_error('capacity', 'L’aforament ha de ser com a mínim una plaça.')
        for field in ('price', 'deposit'):
            if data.get(field) is not None and data[field] < 0:
                self.add_error(field, 'L’import no pot ser negatiu.')
        if data.get('price') is not None and data.get('deposit') is not None and data['deposit'] > data['price']:
            self.add_error('deposit', 'La senyal no pot superar el preu per persona.')
        return data

class ReservationForm(forms.Form):
    customer = forms.ModelChoiceField(queryset=Customer.objects.all(), label='Clienta existent', required=False, empty_label='Selecciona una clienta o dona-la d’alta a sota')
    name = forms.CharField(label='Nom de la nova clienta', max_length=160, required=False)
    phone = forms.CharField(label='Telèfon', max_length=40, required=False)
    email = forms.EmailField(label='Correu electrònic', required=False)
    seats = forms.IntegerField(label='Nombre de places',min_value=1, initial=1)
    waiting = forms.BooleanField(label='Afegir a la llista d’espera (no ocupa places)',required=False)
    def clean(self):
        data = super().clean()
        if not data.get('customer') and not data.get('name'): raise forms.ValidationError('Selecciona una clienta o indica el nom de la nova clienta.')
        if data.get('customer') and (data.get('name') or data.get('phone') or data.get('email')): raise forms.ValidationError('Tria una clienta existent o dona’n d’alta una de nova.')
        return data

class PaymentForm(forms.Form):
    amount = forms.DecimalField(label='Import rebut (€)',min_value=Decimal('0.01'),max_digits=9,decimal_places=2)
    method = forms.ChoiceField(label='Mètode',choices=[('bizum','Bizum'),('cash','Efectiu')])
    concept = forms.ChoiceField(label='Concepte',choices=[('deposit','Paga i senyal'),('balance','Saldo final')])
    paid_at = forms.DateTimeField(label='Data i hora del cobrament',widget=LocalDateTime(),initial=timezone.now)

class ChangeForm(forms.Form):
    action = forms.ChoiceField(choices=[(a,a) for a in ['cancel','promote','seats','extend','attendance']])
    seats = forms.IntegerField(min_value=1,required=False)
    due_at = forms.DateTimeField(widget=LocalDateTime(),required=False)
    attendance = forms.IntegerField(min_value=0,required=False)
