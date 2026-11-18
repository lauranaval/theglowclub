from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone

class Workshop(models.Model):
    title = models.CharField(max_length=160)
    location = models.CharField(max_length=200)
    notes = models.TextField(blank=True)
    payment_hours = models.PositiveIntegerField(default=48)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.CheckConstraint(condition=Q(payment_hours__gt=0), name='positive_deadline')]
    def __str__(self): return self.title

class Session(models.Model):
    workshop = models.ForeignKey(Workshop, on_delete=models.PROTECT, related_name='sessions')
    starts_at = models.DateTimeField()
    capacity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=9, decimal_places=2)
    deposit = models.DecimalField(max_digits=9, decimal_places=2)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['starts_at']
        constraints = [models.CheckConstraint(condition=Q(capacity__gt=0) & Q(price__gte=0) & Q(deposit__gte=0) & Q(deposit__lte=models.F('price')), name='valid_session_terms')]
    @property
    def occupied(self): return self.reservations.filter(status__in=Reservation.ACTIVE).aggregate(n=Sum('seats'))['n'] or 0
    @property
    def available(self): return self.capacity - self.occupied

class Customer(models.Model):
    name = models.CharField(max_length=160)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta: ordering = ['name']
    def __str__(self): return f'{self.name} · {self.phone}' if self.phone else self.name

class Reservation(models.Model):
    PENDING, CONFIRMED, WAITING, CANCELLED = 'pending', 'confirmed', 'waiting', 'cancelled'
    ACTIVE = (PENDING, CONFIRMED)
    STATUSES = [(PENDING,'Pendent de senyal'),(CONFIRMED,'Confirmada'),(WAITING,"Llista d’espera"),(CANCELLED,'Cancel·lada')]
    session = models.ForeignKey(Session, on_delete=models.PROTECT, related_name='reservations')
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT)
    seats = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=9, decimal_places=2)
    unit_deposit = models.DecimalField(max_digits=9, decimal_places=2)
    due_at = models.DateTimeField()
    status = models.CharField(max_length=12, choices=STATUSES, default=PENDING)
    attendance = models.PositiveIntegerField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['created_at','pk']
        constraints = [models.CheckConstraint(condition=Q(seats__gt=0) & Q(unit_price__gte=0) & Q(unit_deposit__gte=0) & Q(unit_deposit__lte=models.F('unit_price')), name='valid_reservation_terms'), models.CheckConstraint(condition=Q(attendance__isnull=True) | Q(attendance__lte=models.F('seats')), name='valid_attendance')]
    @property
    def total(self): return self.seats * self.unit_price
    @property
    def required(self): return self.seats * self.unit_deposit
    @property
    def paid(self): return self.payments.aggregate(n=Sum('amount'))['n'] or Decimal('0')
    @property
    def deposit_paid(self): return self.payments.filter(concept='deposit').aggregate(n=Sum('amount'))['n'] or Decimal('0')
    @property
    def deposit_pending(self): return max(Decimal('0'), self.required - self.deposit_paid)
    @property
    def balance(self): return max(Decimal('0'), self.total - self.paid)
    @property
    def overdue(self): return self.status == self.PENDING and self.deposit_pending > 0 and self.due_at < timezone.now()
    @property
    def settled(self): return self.balance == 0 and self.status == self.CONFIRMED

class Payment(models.Model):
    reservation = models.ForeignKey(Reservation, on_delete=models.PROTECT, related_name='payments')
    amount = models.DecimalField(max_digits=9, decimal_places=2)
    paid_at = models.DateTimeField()
    method = models.CharField(max_length=10, choices=[('bizum','Bizum'),('cash','Efectiu')])
    concept = models.CharField(max_length=10, choices=[('deposit','Paga i senyal'),('balance','Saldo final')])
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    recorded_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['paid_at','pk']
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0),name='positive_payment'), models.CheckConstraint(condition=Q(concept='balance') | Q(method='bizum'),name='deposit_bizum')]

class Audit(models.Model):
    reservation = models.ForeignKey(Reservation, on_delete=models.PROTECT, related_name='history')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=250)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta: ordering = ['-created_at']
