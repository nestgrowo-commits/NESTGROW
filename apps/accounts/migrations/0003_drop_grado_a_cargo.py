from django.db import migrations


def drop_grado_a_cargo(apps, schema_editor):
    db = schema_editor.connection.vendor
    with schema_editor.connection.cursor() as cursor:
        if db == 'sqlite':
            cursor.execute(
                "SELECT name FROM pragma_table_info('accounts_profesorprofile') WHERE name='grado_a_cargo'"
            )
            exists = cursor.fetchone()
        else:
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='accounts_profesorprofile' AND column_name='grado_a_cargo'"
            )
            exists = cursor.fetchone()

        if exists:
            cursor.execute(
                "ALTER TABLE accounts_profesorprofile DROP COLUMN grado_a_cargo"
            )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_alter_customuser_options_and_more'),
    ]

    operations = [
        migrations.RunPython(drop_grado_a_cargo, migrations.RunPython.noop),
    ]
