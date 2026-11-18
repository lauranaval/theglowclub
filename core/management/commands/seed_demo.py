import os
from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from core.models import Workshop, Session, Customer
from core.services import reserve

class Command(BaseCommand):
    help = 'Crea comptes i dades fictícies (idempotent); només per a desenvolupament.'
    def handle(self, *args, **options):
        from django.conf import settings
        if not settings.DEBUG: raise CommandError('Les dades demo només es creen amb GLOW_DEBUG=1.')
        with transaction.atomic():
            for username in ['laura','elena','sandra']:
                user,created=User.objects.get_or_create(username=username,defaults={'first_name':username.capitalize()})
                if created:
                    user.set_password(os.environ.get('GLOW_DEMO_PASSWORD','GlowDemo2026!')); user.save()
            user=User.objects.get(username='laura')
            if Workshop.objects.exists():
                self.stdout.write('Ja hi ha tallers. No s’han duplicat dades.'); return
            w=Workshop.objects.create(title='Crea el teu charm',location='L’estudi Glow · Mataró',payment_hours=48,notes='Dades completament fictícies per provar el primer bloc.',created_by=user)
            s=Session.objects.create(workshop=w,starts_at=timezone.now()+timedelta(days=14),capacity=12,price=Decimal('35'),deposit=Decimal('20'),created_by=user)
            c=Customer.objects.create(name='Júlia Exemple',phone='600000001',email='julia@example.test',created_by=user)
            Customer.objects.create(name='Marta Prova',phone='600000002',created_by=user)
            r=reserve(s.pk,c,1,False,user)
            r.due_at=timezone.now()-timedelta(hours=2); r.save(update_fields=['due_at'])
            w2=Workshop.objects.create(title='Polseres amb història',location='Espai creatiu · Mataró',payment_hours=24,created_by=user)
            Session.objects.create(workshop=w2,starts_at=timezone.now()+timedelta(days=21),capacity=8,price=28,deposit=10,created_by=user)
        self.stdout.write(self.style.SUCCESS('Demo creada. Comptes: laura, elena, sandra. Contrasenya: GLOW_DEMO_PASSWORD o GlowDemo2026!'))
