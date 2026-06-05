import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# Solo replicar modelos propios de la app, nunca los de Django/sesiones/etc.
SYNC_APPS = {'accounts', 'content', 'games', 'talleres', 'historia', 'core', 'asistente'}


def _railway_disponible():
    return 'railway' in getattr(settings, 'DATABASES', {})


def sync_save(sender, instance, **kwargs):
    if not _railway_disponible():
        return
    if kwargs.get('using') == 'railway':
        return  # evitar bucle infinito
    if sender._meta.app_label not in SYNC_APPS:
        return
    try:
        instance.save(using='railway')
    except Exception as e:
        logger.warning(
            "[sync→Railway] %s pk=%s: %s", sender.__name__, instance.pk, e
        )


def sync_delete(sender, instance, **kwargs):
    if not _railway_disponible():
        return
    if kwargs.get('using') == 'railway':
        return
    if sender._meta.app_label not in SYNC_APPS:
        return
    try:
        sender.objects.using('railway').filter(pk=instance.pk).delete()
    except Exception as e:
        logger.warning(
            "[sync→Railway] DELETE %s pk=%s: %s", sender.__name__, instance.pk, e
        )
