const ROLE_ROUTE_MAP = {
  admin: 'AdminDashboard',
  reception: 'Reception',
  caisse: 'Cashier',
  medecin: 'DoctorDashboard',
  labo: 'LaboDashboard',
  pharmacie: 'PharmacyDashboard',
  soins: 'SoinsDashboard',
};

const TYPE_ROUTE_MAP = {
  admin_alert: { route: 'AdminDashboard' },
  billing: { route: 'Cashier', tab: 'pending' },
  broadcast: { route: 'StaffMessages' },
  emergency: { route: 'SoinsDashboard', tab: 'urgencies' },
  hospitalization: { route: 'SoinsDashboard', tab: 'hospitalisation' },
  insurance: { route: 'Cashier', tab: 'insurances' },
  lab_order: { route: 'LaboDashboard', tab: 'pending' },
  lab_result: { route: 'DoctorDashboard', tab: 'results' },
  message: { route: 'StaffMessages' },
  new_patient: { route: 'Reception', tab: 'patients' },
  nursing_report: { route: 'SoinsDashboard', tab: 'rapport' },
  pharmacy_order: { route: 'PharmacyDashboard', tab: 'dispense' },
  stock_alert: { route: 'PharmacyDashboard', tab: 'stock' },
};

const read = (source, ...keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return source[key];
  }
  return undefined;
};

const parseData = (data) => {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return typeof data === 'object' ? data : {};
};

const textIncludes = (text, words) => words.some(word => text.includes(word));

export const normalizeNotification = (notification = {}) => {
  const data = parseData(notification.data);
  return {
    ...data,
    notificationId: read(notification, 'id', 'notification_id', 'notificationId'),
    type: read(data, 'type') || read(notification, 'type'),
    role: read(data, 'role') || read(notification, 'role'),
    title: read(notification, 'title') || read(data, 'title') || '',
    body: read(notification, 'body') || read(data, 'body') || '',
    visitId: read(data, 'visitId', 'visit_id') || read(notification, 'visitId', 'visit_id'),
    patientId: read(data, 'patientId', 'patient_id') || read(notification, 'patientId', 'patient_id'),
    invoiceId: read(data, 'invoiceId', 'invoice_id') || read(notification, 'invoiceId', 'invoice_id'),
    medicineId: read(data, 'medicineId', 'medicine_id') || read(notification, 'medicineId', 'medicine_id'),
    hospitalizationId: read(data, 'hospitalizationId', 'hospitalization_id') || read(notification, 'hospitalizationId', 'hospitalization_id'),
    labOrderId: read(data, 'labOrderId', 'lab_order_id') || read(notification, 'labOrderId', 'lab_order_id'),
    messageId: read(data, 'messageId', 'message_id') || read(notification, 'messageId', 'message_id'),
    tab: read(data, 'tab', 'screen', 'view') || read(notification, 'tab', 'screen', 'view'),
  };
};

const inferTarget = (payload, fallbackRole) => {
  const role = payload.role || fallbackRole;
  const text = `${payload.title} ${payload.body} ${payload.type || ''}`.toLowerCase();

  if (payload.type && TYPE_ROUTE_MAP[payload.type]) return TYPE_ROUTE_MAP[payload.type];
  if (textIncludes(text, ['message', 'broadcast', 'communication'])) return TYPE_ROUTE_MAP.message;
  if (textIncludes(text, ['facture', 'paiement', 'caisse', 'invoice'])) return TYPE_ROUTE_MAP.billing;
  if (textIncludes(text, ['examen', 'labo', 'laboratoire'])) return TYPE_ROUTE_MAP.lab_order;
  if (textIncludes(text, ['resultat', 'résultat'])) return TYPE_ROUTE_MAP.lab_result;
  if (textIncludes(text, ['ordonnance', 'pharmacie', 'médicament', 'medicament'])) return TYPE_ROUTE_MAP.pharmacy_order;
  if (textIncludes(text, ['stock', 'rupture', 'expiration', 'péremption', 'peremption'])) return TYPE_ROUTE_MAP.stock_alert;
  if (textIncludes(text, ['hospitalisation', 'hospitalization'])) return TYPE_ROUTE_MAP.hospitalization;
  if (textIncludes(text, ['rapport de garde', 'rapport'])) return TYPE_ROUTE_MAP.nursing_report;
  if (textIncludes(text, ['urgence', 'emergency'])) return TYPE_ROUTE_MAP.emergency;

  if (role === 'caisse') return TYPE_ROUTE_MAP.billing;
  if (role === 'labo') return TYPE_ROUTE_MAP.lab_order;
  if (role === 'medecin') return { route: 'DoctorDashboard', tab: 'queue' };
  if (role === 'pharmacie') return TYPE_ROUTE_MAP.pharmacy_order;
  if (role === 'soins') return { route: 'SoinsDashboard', tab: 'queue' };
  if (role === 'reception') return { route: 'Reception', tab: 'patients' };
  if (role === 'admin') return { route: 'AdminDashboard' };

  return { route: ROLE_ROUTE_MAP[fallbackRole] || 'Notification' };
};

export const resolveNotificationTarget = (notification, fallbackRole) => {
  const payload = normalizeNotification(notification);
  const target = inferTarget(payload, fallbackRole);
  const route = target?.route || 'Notification';
  const tab = payload.tab || target?.tab;

  return {
    route,
    params: {
      notificationId: payload.notificationId,
      visitId: payload.visitId,
      patientId: payload.patientId,
      invoiceId: payload.invoiceId,
      medicineId: payload.medicineId,
      hospitalizationId: payload.hospitalizationId,
      labOrderId: payload.labOrderId,
      messageId: payload.messageId,
      tab,
    },
  };
};

export const navigateFromNotification = (navigation, notification, fallbackRole) => {
  const target = resolveNotificationTarget(notification, fallbackRole);
  if (!target?.route) return false;
  navigation.navigate(target.route, target.params);
  return true;
};
