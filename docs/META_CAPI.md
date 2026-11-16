# Integración WhaTicket → Meta Conversions API

Cuando a un ticket se le **agrega** una etiqueta, WhaTicket envía un evento al dataset (píxel) de Meta:

| Etiqueta   | Evento en Meta | Notas                                                      |
|------------|----------------|------------------------------------------------------------|
| `Contacto` | `Lead`         | Sale como `LeadSubmitted` si va por business_messaging     |
| `Venta`    | `Purchase`     | Lleva `currency` (CLP) y `value` (`META_PURCHASE_VALUE`)   |

- Las etiquetas se crean solas con la migración `20261115000000-meta-capi-ctwa-and-tags` (si ya existían con ese nombre, no se duplican).
- Solo dispara al **agregar**: quitar una etiqueta no envía nada. Si se quita y se vuelve a poner, el `event_id` es el mismo (`wt-ticket{id}-tag{id}`) y Meta lo deduplica.
- Se envía el teléfono del contacto **hasheado** (SHA-256), nunca en claro.
- Si el contacto llegó desde un anuncio Click-to-WhatsApp y se pudo capturar su `ctwa_clid`, y está `META_WABA_ID`, el evento va como `business_messaging` (atribución exacta al anuncio). Si no, va como `chat` y Meta lo matchea por teléfono.
- Sin `META_DATASET_ID`/`META_ACCESS_TOKEN` funciona en **dry run**: solo escribe el payload en los logs (`Meta CAPI (dry run...)`).

Código: `backend/src/services/MetaServices/SendMetaConversionService.ts` (enganchado en `SyncTagsService`).

## Qué sacar de Meta Business

1. **Dataset ID** (es el mismo número que el "Pixel ID").
2. **Access token** de la Conversions API (este es "el otro dato").
3. **Código de prueba** (`TEST...`) — solo mientras se prueba.
4. *(Opcional, recomendado)* **WABA ID**: el ID de la cuenta de WhatsApp Business.

### Paso a paso

1. Entrar a **Administrador de eventos** (business.facebook.com/events_manager) con acceso al Business del cliente.
2. **Conectar orígenes de datos → Web** (o "CRM" si lo ofrece) → nombre: `Prueba CRM WhaTicket`. Eso crea el dataset de prueba.
   Copiar su **ID** → `META_DATASET_ID`.
3. En el dataset: **Configuración → API de conversiones → Configurar manualmente → Generar token de acceso**. Copiarlo → `META_ACCESS_TOKEN` (se ve una sola vez; si se pierde, se genera otro).
4. En el dataset: pestaña **Probar eventos** → copiar el código `TEST12345` → `META_TEST_EVENT_CODE`.
5. *(Opcional)* **Administrador de WhatsApp** → la cuenta → copiar el **ID de la cuenta de WhatsApp Business** → `META_WABA_ID`. Vincular el dataset a esa cuenta si Meta lo ofrece (Configuración del dataset → Activos conectados).

## Variables en Railway (servicio whaticket backend)

```
META_DATASET_ID=
META_ACCESS_TOKEN=
META_TEST_EVENT_CODE=TEST12345
META_TAG_EVENTS=contacto:Lead,venta:Purchase
META_CURRENCY=CLP
META_PURCHASE_VALUE=0
META_WABA_ID=
```

## Prueba

1. Con las variables cargadas, abrir un ticket de prueba y agregarle la etiqueta **Contacto**.
2. En los logs debe aparecer `Meta CAPI ok (Lead, wt-ticket...)` con `events_received: 1`.
3. En **Probar eventos** del dataset debe aparecer el evento `Lead` en unos segundos.
4. Repetir con **Venta** → `Purchase`.

Si falla, el log dice `Meta CAPI: error enviando ...` con la respuesta de Meta (token vencido, dataset equivocado, etc.).

## Paso a producción

- Opción A (lo planteado): crear el dataset definitivo, cambiar `META_DATASET_ID` y `META_ACCESS_TOKEN` por los suyos y **borrar** `META_TEST_EVENT_CODE`.
- Opción B: usar el mismo dataset y solo borrar `META_TEST_EVENT_CODE` (los eventos con código de prueba no cuentan para campañas, así que no "ensucian" el dataset).

Al crear la campaña, en el conjunto de anuncios se elige el **dataset** y el **evento de conversión** (`Lead` o `Purchase`).

## WhatsApp Cloud API (coexistencia): webhook y plantillas

Los chats se siguen atendiendo por WhatsApp Web (QR). La Cloud API se usa para:

1. **Webhook** `https://<backend>/meta/webhook`:
   - `messages`: si el mensaje viene de un anuncio, guarda `referral.ctwa_clid` en el contacto. Así, los eventos de Contacto/Venta salen como `business_messaging`, con atribución exacta al anuncio.
   - `statuses`: ticks (enviado/entregado/leído) de las plantillas enviadas.
   - `message_template_status_update`: aviso en pantalla cuando Meta aprueba o rechaza una plantilla.
2. **Plantillas** (menú *Administración → Plantillas*): crear (nombre, categoría, idioma, encabezado, cuerpo con `{{1}}`, pie, botones de respuesta rápida), mandarlas a aprobación, ver su estado y borrarlas, todo sin entrar a Meta.
3. **Enviar plantilla** desde el ticket: ícono de lista junto al clip. Elegís una plantilla aprobada, completás las variables y se envía por la API. Sirve aunque hayan pasado más de 24 h desde el último mensaje del cliente.

### Alta del número desde el CRM (Conexiones → "WhatsApp API (Meta)")

Arriba de la tabla de conexiones QR hay una tarjeta **WhatsApp API (Meta) — coexistencia** con el botón **Conectar con Meta** (solo administradores). Abre la ventana de Meta (Embedded Signup) y ahí:

1. Iniciás sesión con Facebook y elegís o creás el portfolio del negocio.
2. Elegís conectar la **app WhatsApp Business existente** e ingresás el número.
3. Meta muestra un **QR**: se escanea **desde la app WhatsApp Business del celular** (no es el QR de WhaTicket). También llega un mensaje al número con el enlace al QR.
4. Opcional: compartir el historial de chats.
5. Al cerrar, el CRM canjea el código por el token, se suscribe al webhook de esa cuenta, pide la sincronización de contactos e historial y guarda todo (token, WABA y número) en la base. No hace falta copiar nada a mano.

También sirve para un **número nuevo solo API** (sin app en el celular): si en la ventana se elige esa opción, el CRM registra el número en la Cloud API con un PIN de dos pasos que queda guardado en la tabla `Settings` (`metaRegisterPin`).

- **Verificar** consulta en vivo el estado del número en Meta (nombre, calidad, si sigue en la app, apps suscritas).
- **Desconectar** borra las credenciales del CRM; no da de baja el número en Meta ni lo saca del celular.
- La conexión QR de WhaTicket (tabla de abajo) es independiente: después del alta, revisar que siga conectada y, si se cayó, reescanear.

### Qué configurar en Meta (una sola vez, antes del botón)

1. **App de Meta** (developers.facebook.com → Crear app → tipo *Negocios*), dentro del portfolio del cliente. Agregarle los productos **WhatsApp** y **Facebook Login for Business**.
   - App → Configuración → Básica: copiar **ID de la app** → `META_APP_ID` y **Clave secreta** → `META_APP_SECRET`.
   - Agregar el dominio del CRM (`mantenertoken-production.up.railway.app`) en *Dominios de la app* y en Facebook Login for Business → *Dominios permitidos para el SDK de JavaScript*.
2. **Configuración de Embedded Signup**: Facebook Login for Business → Configuraciones → Crear → variante *WhatsApp Embedded Signup*, con permisos `whatsapp_business_management` y `whatsapp_business_messaging` → copiar el **ID de configuración** → `META_ES_CONFIG_ID`.
3. **Webhook**: App → WhatsApp → Configuración → Webhook:
   - URL de devolución de llamada: `https://whaticket-community-production-d61c.up.railway.app/meta/webhook`
   - Token de verificación: el mismo valor que `META_WEBHOOK_VERIFY_TOKEN` (inventarlo)
   - Suscribirse a los campos `messages` y `message_template_status_update`.
4. Cargar en Railway (servicio WhaTicket backend) `META_APP_ID`, `META_APP_SECRET`, `META_ES_CONFIG_ID`, `META_WEBHOOK_VERIFY_TOKEN`. Con eso se habilita el botón.
5. **Dataset vinculado a WhatsApp** (para eventos `business_messaging`): en el Administrador de eventos, vincular el dataset a la cuenta de WhatsApp Business (Configuración → Activos conectados). También se puede obtener con `GET /{WABA_ID}/dataset`, que devuelve (o crea) el dataset de esa cuenta.

Notas:
- Si la App y el número son del mismo portfolio del cliente, debería alcanzar con la App en modo desarrollo y el usuario como administrador de la App. Para dar de alta números de **otros** negocios, Meta exige ser proveedor de tecnología (verificación del negocio y revisión de la app).
- Alternativa sin botón: cargar a mano `META_WHATSAPP_TOKEN` (token de un usuario del sistema), `META_WABA_ID` y `META_PHONE_NUMBER_ID`. Lo conectado desde el CRM tiene prioridad sobre esas variables.

### Prueba del webhook

- Al guardar el webhook en Meta, el log debe mostrar la verificación sin errores (Meta llama a `GET /meta/webhook`).
- Hacer clic en un anuncio Click-to-WhatsApp de prueba y escribir: el log debe mostrar `Meta webhook: ctwa_clid guardado para el contacto ...`.
- Agregar la etiqueta *Contacto* a ese ticket: el evento debe salir como `LeadSubmitted` / `business_messaging`.

## Pendientes / a verificar

- **WhatsApp Web después de la coexistencia**: confirmar que la sesión QR de WhaTicket siga conectada una vez hecha el alta. Si una plantilla enviada por la API aparece duplicada en el chat (una vez por la API y otra por WhatsApp Web), hay que filtrar ese eco.
- **ctwa_clid sin Cloud API**: WhatsApp Web no lo expone de forma confirmada. El log `ctwaContext recibido, campos: ...` sirve para verificarlo, pero la fuente confiable es el webhook.
- **Valor de la venta**: hoy es fijo (`META_PURCHASE_VALUE`). Se podría tomar el monto de la Opportunity de EspoCRM.
- **Coexistencia + WhatsApp Web**: al pasar el número a la API por coexistencia, confirmar que la sesión de WhaTicket (dispositivo vinculado) siga conectada.
