from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.crypto import get_random_string

class Command(BaseCommand):
    help = 'Crea els tres comptes amb correus reals i contrasenyes aleatòries no divulgades. Activa’ls per recuperació de contrasenya.'
    def add_arguments(self, parser):
        for name in ('laura','elena','sandra'):
            parser.add_argument(f'--{name}-email', required=True)
    @transaction.atomic
    def handle(self, *args, **options):
        emails=[options[f'{name}_email'].strip().lower() for name in ('laura','elena','sandra')]
        if len(set(emails)) != 3: raise CommandError('Cal un correu diferent per a cada usuària.')
        for email in emails:
            try: validate_email(email)
            except ValidationError: raise CommandError('Hi ha una adreça de correu no vàlida.')
        for name,email in zip(('laura','elena','sandra'),emails):
            if User.objects.filter(username=name).exists():
                raise CommandError(f'El compte {name} ja existeix. Revisa’l abans de continuar; no se sobreescriu.')
            if User.objects.filter(email__iexact=email).exists(): raise CommandError('Un dels correus ja està assignat a un compte.')
            User.objects.create_user(name,email=email,password=get_random_string(64),first_name=name.capitalize())
        self.stdout.write(self.style.SUCCESS('Tres comptes creats. Cada usuària pot establir la seva contrasenya amb «He oblidat la contrasenya». Cal SMTP configurat.'))
