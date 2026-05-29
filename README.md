# BarberBot · WhatsApp Business para barberías

MVP listo para producción: el cliente escribe **"reservar"** por WhatsApp, se abre un **WhatsApp Flow**, elige servicio → día → hora, y queda confirmado. El sistema envía un recordatorio automático **24 h antes** y permite cancelar con la palabra **"cancelar"**.

Hecho con Node.js + Express + SQLite. Pensado para vender como servicio mensual (SaaS para una barbería). Para multi-barbería, ver sección final.

---

## 1. Lo que necesitas tener antes de empezar

1. Una **cuenta de Meta Business Suite** (gratuita) → https://business.facebook.com
2. Un **número de teléfono** que NO esté en WhatsApp normal (puede ser uno fijo, virtual o un móvil nuevo). Meta da uno de pruebas gratis para empezar.
3. Una cuenta en **Railway**, **Render** o **Fly.io** para alojar el servidor (≈5 €/mes).
4. Un **dominio o subdominio con HTTPS** (Railway/Render dan uno gratis del tipo `barberbot.up.railway.app`).

---

## 2. Arrancar en local (10 min)

```bash
# 1. Instala dependencias
npm install

# 2. Copia variables de entorno y rellénalas
cp .env.example .env

# 3. Inicializa la base de datos con los 5 servicios de ejemplo
npm run db:init

# 4. Arranca
npm start
```

Si todo va bien verás:

```
BarberBot escuchando en :3000
Cron de recordatorios activo (cada hora).
```

---

## 3. Configurar WhatsApp Cloud API (paso a paso)

1. Entra en https://developers.facebook.com → **Mis apps** → **Crear app** → tipo **Business**.
2. Añade el producto **WhatsApp**. Te dará un `phone_number_id`, un `business_account_id` y un token de prueba.
3. Pon esos valores en tu `.env`:
   ```
   WHATSAPP_PHONE_NUMBER_ID=...
   WHATSAPP_BUSINESS_ACCOUNT_ID=...
   WHATSAPP_TOKEN=...
   ```
4. Para producción, genera un **token permanente** (System User en Meta Business → "Generar nuevo token" con permisos `whatsapp_business_messaging` y `whatsapp_business_management`).
5. Sube tu app a un hosting con HTTPS (ver sección 5) y obtén la URL pública, por ejemplo `https://barberbot.up.railway.app`.
6. En el panel de Meta → **WhatsApp → Configuración → Webhooks**:
   - URL: `https://barberbot.up.railway.app/webhook`
   - Verify token: el mismo valor que pusiste en `WEBHOOK_VERIFY_TOKEN`.
   - Suscríbete al campo **messages**.

---

## 4. Configurar el WhatsApp Flow

### 4.1 Generar el par de claves de cifrado

Meta exige cifrado de extremo a extremo en el endpoint del Flow.

```bash
node scripts/generate-keys.js "una_passphrase_segura"
```

Copia el output en tu `.env` (`FLOW_PRIVATE_KEY`, `FLOW_PUBLIC_KEY`, `FLOW_PASSPHRASE`).

Después sube la **clave pública** a Meta con esta llamada (curl):

```bash
curl -X POST \
  "https://graph.facebook.com/v20.0/$WHATSAPP_PHONE_NUMBER_ID/whatsapp_business_encryption" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN" \
  --data-urlencode "business_public_key=$(cat tu_clave_publica.pem)"
```

### 4.2 Crear el Flow en Meta

1. Ve a **Meta Business Suite → WhatsApp → Flows → Crear Flow**.
2. Nómbralo `reserva_barberia`, categoría **APPOINTMENT_BOOKING**.
3. En el editor JSON pega el contenido de `flows/booking-flow.json`.
4. Endpoint URL: `https://barberbot.up.railway.app/flow`.
5. Pulsa **Validar** y luego **Publicar**. Te dará un `FLOW_ID` que también va en `.env`.

---

## 5. Despliegue en Railway (recomendado, 5 minutos)

1. Sube el código a GitHub (incluye el `.gitignore`, **nunca subas el `.env`**).
2. https://railway.app → **New Project → Deploy from GitHub repo**.
3. Variables: pega todo el contenido de tu `.env` en **Variables**.
4. Railway detecta `package.json` y lanza `npm start`.
5. En **Settings → Networking** activa el dominio público.
6. Pon ese dominio en el webhook de Meta y en el Endpoint URL del Flow.

Alternativa con Render: mismo flujo, eligiendo "Web Service" → Node, comando `npm start`.

---

## 6. Probar la reserva

1. Envía un WhatsApp a tu número Meta con la palabra **"reservar"** desde tu móvil.
2. El bot responderá con el botón **"Reservar cita"**.
3. Tócalo → elige servicio → día → hora → tu nombre → **Confirmar**.
4. Recibirás el mensaje de confirmación.
5. Al día siguiente recibirás el recordatorio automático.

---

## 7. Personalizar para cada cliente nuevo

Para vender a otra barbería, solo necesitas cambiar las variables del `.env`:

| Variable                | Significado                                      |
| ----------------------- | ------------------------------------------------ |
| `SHOP_NAME`             | Nombre que aparece en los mensajes               |
| `SHOP_TIMEZONE`         | `Europe/Madrid`, `America/Mexico_City`, etc.     |
| `SHOP_OPEN_HOUR`        | Hora de apertura (24h)                           |
| `SHOP_CLOSE_HOUR`       | Hora de cierre (24h)                             |
| `SHOP_SLOT_MINUTES`     | Granularidad de los huecos (30 → cada media h)   |
| `SHOP_CLOSED_DAYS`      | Días cerrados, separados por coma (0 = domingo)  |

Y editar los servicios en `scripts/init-db.js` antes de la primera ejecución, o más adelante con cualquier visor SQLite.

---

## 8. Comandos útiles

```bash
npm run db:init   # crea la BD y siembra servicios de ejemplo
npm start         # arranca el servidor
npm run dev       # arranca con nodemon (recarga al guardar)
```

---

## 9. Cómo escalar a multi-barbería (cuando vendas a la 5ª)

- Añade tabla `shops` y `shop_id` como FK en `services`, `clients`, `appointments`.
- Mapea el `WHATSAPP_PHONE_NUMBER_ID` recibido en el webhook → `shop_id`.
- Mueve la configuración del horario (`SHOP_*`) a una fila por barbería.
- Si crece a más de ~20 barberías, migra a Postgres (cambia `better-sqlite3` por `pg`).

---

## 10. Modelo comercial sugerido

- **Setup**: 199 € (alta del número, configuración Flow, formación).
- **Mensualidad**: 29-49 €/mes por barbería.
- **Coste real**: WhatsApp cobra ≈ 0,005 €/conversación de servicio; las de cliente las paga el cliente al iniciarlas.

Con 20 barberías = ~700 €/mes recurrentes. Punto de equilibrio en la barbería 3.
