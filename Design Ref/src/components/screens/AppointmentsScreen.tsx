import React, { useState } from 'react';
import {
  CalendarDays,
  Plus,
  Clock,
  User,
  Share2,
  CheckCircle2,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import {
  Appointment,
  AppointmentStatus,
  BranchId,
  Language,
  WhatsAppStatus,
} from '../../types';
import { translations } from '../../i18n/translations';
import {
  mockAppointments,
  mockDentalServices,
  mockCustomers,
} from '../../data/mockData';
import { StatusPill } from '../common/StatusPill';
import { Drawer } from '../common/Drawer';

interface AppointmentsScreenProps {
  currentBranch: BranchId;
  language: Language;
}

export const AppointmentsScreen: React.FC<AppointmentsScreenProps> = ({
  currentBranch,
  language,
}) => {
  const t = translations[language];

  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [selectedDentist, setSelectedDentist] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Booking drawer
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [patientName, setPatientName] = useState('Ayaan Abdi Mohamed');
  const [patientPhone, setPatientPhone] = useState('+252 63 4819201');
  const [dentistName, setDentistName] = useState('Dr. Sahra Awale');
  const [serviceId, setServiceId] = useState('srv-2');
  const [appointmentDate, setAppointmentDate] = useState('2026-10-13');
  const [appointmentTime, setAppointmentTime] = useState('16:00');
  const [bookingNotes, setBookingNotes] = useState('');

  const dentists = ['Dr. Sahra Awale', 'Dr. Guled Farah', 'Dr. Hibaaq Warsame'];

  const filteredAppointments = appointments.filter((a) => {
    const matchesBranch = currentBranch === 'all' || a.branchId === currentBranch;
    const matchesDentist = selectedDentist === 'all' || a.dentistName === selectedDentist;
    return matchesBranch && matchesDentist;
  });

  const handleCreateBooking = () => {
    const srv = mockDentalServices.find((s) => s.id === serviceId) || mockDentalServices[0];
    const newApt: Appointment = {
      id: `apt-${Date.now()}`,
      patientId: `cust-rt-${Date.now()}`,
      patientName,
      patientPhone,
      dentistName,
      serviceId: srv.id,
      serviceName: srv.name,
      date: appointmentDate,
      time: appointmentTime,
      durationMinutes: srv.durationMinutes,
      branchId: currentBranch === 'all' ? 'main' : currentBranch,
      status: 'Scheduled',
      whatsappStatus: 'Sent',
      notes: bookingNotes || 'Booked at reception',
      amount: srv.retailPrice,
    };

    setAppointments([newApt, ...appointments]);
    setIsBookingOpen(false);
    setBookingNotes('');
  };

  const daysOfWeek = [
    { name: 'Mon', date: '2026-10-12' },
    { name: 'Tue (Today)', date: '2026-10-13' },
    { name: 'Wed', date: '2026-10-14' },
    { name: 'Thu', date: '2026-10-15' },
    { name: 'Fri', date: '2026-10-16' },
  ];

  const getWhatsAppPillVariant = (status: WhatsAppStatus) => {
    if (status === 'Replied "Confirm"') return 'replied';
    if (status === 'Delivered') return 'delivered';
    if (status === 'Read') return 'read';
    return 'scheduled';
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.nav.appointments} & Operating Calendar
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Dentist timetables, chair booking slots, and two-way automated WhatsApp confirmation telemetry
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsBookingOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-[10px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Book Appointment</span>
        </button>
      </div>

      {/* Control Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0F2830] p-4 rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs">
        {/* Dentist Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">Dentist:</span>
          <select
            value={selectedDentist}
            onChange={(e) => setSelectedDentist(e.target.value)}
            className="h-9 px-3 text-xs bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] font-medium text-[#10262D] dark:text-[#E8F2F0]"
          >
            <option value="all">All Clinicians (Entire Practice)</option>
            {dentists.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px]">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1 text-xs font-bold rounded-[6px] transition-colors ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-[#0F2830] text-[#0C3B4A] dark:text-[#2CC7BF] shadow-xs'
                : 'text-[#536E75] dark:text-[#8AA4A0]'
            }`}
          >
            Week Calendar by Dentist
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 text-xs font-bold rounded-[6px] transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-[#0F2830] text-[#0C3B4A] dark:text-[#2CC7BF] shadow-xs'
                : 'text-[#536E75] dark:text-[#8AA4A0]'
            }`}
          >
            List Roster ({filteredAppointments.length})
          </button>
        </div>
      </div>

      {/* Week Calendar View */}
      {viewMode === 'calendar' ? (
        <div className="bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] overflow-hidden shadow-xs">
          <div className="grid grid-cols-5 divide-x divide-[#DDE7E5] dark:divide-[#1A4452] border-b border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#143540]">
            {daysOfWeek.map((day) => (
              <div key={day.date} className="p-3 text-center">
                <p className="font-bold text-xs text-[#0C3B4A] dark:text-[#E8F2F0]">{day.name}</p>
                <p className="font-mono text-[11px] text-[#536E75] dark:text-[#8AA4A0]">{day.date}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5 divide-x divide-[#DDE7E5] dark:divide-[#1A4452] min-h-[460px]">
            {daysOfWeek.map((day) => {
              const dayApts = filteredAppointments.filter((a) => a.date === day.date);

              return (
                <div key={day.date} className="p-2 space-y-2.5">
                  {dayApts.length === 0 ? (
                    <div className="py-12 text-center text-[11px] text-[#536E75] dark:text-[#8AA4A0] italic">
                      No bookings
                    </div>
                  ) : (
                    dayApts.map((apt) => (
                      <div
                        key={apt.id}
                        className="p-3 rounded-[8px] border border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7]/60 dark:bg-[#143540]/60 space-y-2 hover:border-[#12A6A0] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="font-mono font-bold text-[#0C3B4A] dark:text-[#2CC7BF]">
                            {apt.time}
                          </span>
                          <StatusPill
                            variant={
                              apt.status === 'Confirmed'
                                ? 'confirmed'
                                : apt.status === 'Completed'
                                ? 'completed'
                                : apt.status === 'Cancelled'
                                ? 'cancelled'
                                : 'scheduled'
                            }
                            label={apt.status}
                            size="sm"
                          />
                        </div>

                        <div>
                          <p className="font-bold text-xs text-[#10262D] dark:text-[#E8F2F0] leading-snug">
                            {apt.patientName}
                          </p>
                          <p className="text-[11px] text-[#536E75] dark:text-[#8AA4A0] mt-0.5 line-clamp-1">
                            {apt.serviceName}
                          </p>
                          <p className="text-[10px] text-[#536E75] dark:text-[#8AA4A0]">
                            {apt.dentistName}
                          </p>
                        </div>

                        {/* WhatsApp Status Pill */}
                        <div className="pt-1.5 border-t border-[#DDE7E5] dark:border-[#1A4452] flex items-center justify-between">
                          <span className="text-[10px] text-[#536E75] dark:text-[#8AA4A0]">
                            WhatsApp:
                          </span>
                          <StatusPill
                            variant={getWhatsAppPillVariant(apt.whatsappStatus)}
                            label={apt.whatsappStatus}
                            size="sm"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List Roster View */
        <div className="bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] overflow-hidden shadow-xs">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="border-b border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] uppercase font-semibold text-[10px]">
                <th className="py-3 px-4 text-start">Date & Time</th>
                <th className="py-3 px-4 text-start">Patient Name</th>
                <th className="py-3 px-4 text-start">Contact</th>
                <th className="py-3 px-4 text-start">Dentist</th>
                <th className="py-3 px-4 text-start">Service</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">WhatsApp Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452]">
              {filteredAppointments.map((apt) => (
                <tr key={apt.id} className="hover:bg-[#F4F8F7]/60 dark:hover:bg-[#143540]/60 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#0C3B4A] dark:text-[#2CC7BF]">
                    {apt.date} {apt.time}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-[#10262D] dark:text-[#E8F2F0]">
                    {apt.patientName}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[#536E75] dark:text-[#8AA4A0]">
                    {apt.patientPhone}
                  </td>
                  <td className="py-3.5 px-4 text-[#10262D] dark:text-[#E8F2F0]">
                    {apt.dentistName}
                  </td>
                  <td className="py-3.5 px-4 text-[#536E75] dark:text-[#8AA4A0]">
                    {apt.serviceName}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <StatusPill
                      variant={
                        apt.status === 'Confirmed'
                          ? 'confirmed'
                          : apt.status === 'Completed'
                          ? 'completed'
                          : apt.status === 'Cancelled'
                          ? 'cancelled'
                          : 'scheduled'
                      }
                      label={apt.status}
                      size="sm"
                    />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <StatusPill
                      variant={getWhatsAppPillVariant(apt.whatsappStatus)}
                      label={apt.whatsappStatus}
                      size="sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Booking Drawer */}
      <Drawer
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        title="Schedule Clinical Appointment"
        subtitle="Book dental chair session with automated WhatsApp reminder trigger"
        width="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsBookingOpen(false)}
              className="px-3 py-2 text-xs font-semibold text-[#536E75]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateBooking}
              className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
            >
              Confirm Appointment
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Patient Full Name *
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            />
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              WhatsApp Phone Number (+252) *
            </label>
            <input
              type="text"
              value={patientPhone}
              onChange={(e) => setPatientPhone(e.target.value)}
              className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            />
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Attending Dentist
            </label>
            <select
              value={dentistName}
              onChange={(e) => setDentistName(e.target.value)}
              className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            >
              {dentists.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Service Procedure
            </label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            >
              {mockDentalServices.map((srv) => (
                <option key={srv.id} value={srv.id}>
                  {srv.name} (${srv.retailPrice.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Date
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              />
            </div>
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Time Slot
              </label>
              <input
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Clinical Symptoms & Notes
            </label>
            <textarea
              rows={2}
              value={bookingNotes}
              onChange={(e) => setBookingNotes(e.target.value)}
              placeholder="e.g. Sensitivity to cold liquids on lower molar..."
              className="w-full p-2.5 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
};
