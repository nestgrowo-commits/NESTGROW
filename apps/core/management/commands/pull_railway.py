import io
import os
import tempfile
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.conf import settings

SYNC_APPS = [
    'accounts', 'content', 'games', 'talleres', 'historia',
]


class Command(BaseCommand):
    help = 'Trae todos los datos de Railway PostgreSQL a SQLite local'

    def add_arguments(self, parser):
        parser.add_argument(
            '--app',
            help='Sincronizar solo una app (ej: accounts, games)',
            default=None,
        )

    def handle(self, *args, **options):
        if 'railway' not in settings.DATABASES:
            self.stdout.write(self.style.ERROR(
                'No hay base de datos "railway" configurada.'
            ))
            return

        apps_to_dump = [options['app']] if options['app'] else SYNC_APPS

        tmp = None
        try:
            for app in apps_to_dump:
                self.stdout.write(f'Descargando {app} de Railway...')
                buf = io.StringIO()
                try:
                    call_command(
                        'dumpdata', app,
                        database='railway',
                        indent=2,
                        stdout=buf,
                    )
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'  {app}: {e}'))
                    continue

                data = buf.getvalue().strip()
                if data in ('', '[]'):
                    self.stdout.write(f'  {app}: sin datos')
                    continue

                with tempfile.NamedTemporaryFile(
                    suffix='.json', delete=False, mode='w', encoding='utf-8'
                ) as f:
                    tmp = f.name
                    f.write(data)

                try:
                    call_command('loaddata', tmp, database='default', verbosity=0)
                    self.stdout.write(f'  {app}: OK')
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'  {app}: {e}'))
                finally:
                    if tmp and os.path.exists(tmp):
                        os.unlink(tmp)
                    tmp = None

            self.stdout.write(self.style.SUCCESS('Sincronizacion Railway -> local completada'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {e}'))
