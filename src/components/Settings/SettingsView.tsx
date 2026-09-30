import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MobileHeaderStatus } from '../MobileHeaderStatus';
import { Clock, MapPin, Save, CheckCircle2, ShieldCheck, UserCheck, GraduationCap, LocateFixed } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, resetToDefaultData } = useApp();

  const [startTime, setStartTime] = useState(settings.startTime);
  const [lateLimitTime, setLateLimitTime] = useState(settings.lateLimitTime);
  const [endTime, setEndTime] = useState(settings.endTime);
  const [locationName, setLocationName] = useState(settings.officeLocation.name || 'Punya Skill Akademi, Bandung');
  const [radiusMeters, setRadiusMeters] = useState(settings.officeLocation.radiusMeters);
  const [officeLat, setOfficeLat] = useState(settings.officeLocation.lat);
  const [officeLng, setOfficeLng] = useState(settings.officeLocation.lng);
  const [locationError, setLocationError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStartTime(settings.startTime);
    setLateLimitTime(settings.lateLimitTime);
    setEndTime(settings.endTime);
    setLocationName(settings.officeLocation.name || 'Punya Skill Akademi, Bandung');
    setRadiusMeters(settings.officeLocation.radiusMeters);
    setOfficeLat(settings.officeLocation.lat);
    setOfficeLng(settings.officeLocation.lng);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');
    setSavedSuccess(false);
    const result = await updateSettings({
      startTime,
      lateLimitTime,
      endTime,
      officeLocation: {
        lat: Number(officeLat),
        lng: Number(officeLng),
        name: locationName,
        radiusMeters: Number(radiusMeters)
      }
    });
    setIsSaving(false);
    if (result.success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } else {
      setSaveError(result.message);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#E4EAF0]">
        <p className="text-[10px] font-bold tracking-[.14em] text-[#4C83B5] uppercase">
          KONFIGURASI LEMBAGA
        </p>
        <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-[#123B59]">
          Pengaturan Presensi & Lokasi GPS
        </h1>
        <p className="text-xs text-[#6F7F8D] mt-1">
          Konfigurasi jam masuk pelatihan kejuruan, batas toleransi keterlambatan, dan parameter radius absensi.
        </p>
        <MobileHeaderStatus />
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-[#EEF6FB] border border-[#C8DCEB] text-[#123B59] rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#4C83B5] shrink-0" />
          <span>Pengaturan presensi berhasil disimpan ke sistem.</span>
        </div>
      )}
      {saveError && (
        <div role="alert" className="p-3.5 bg-[#FFF1F2] border border-[#F2C6CE] text-[#9F2945] rounded-2xl text-xs font-bold">
          {saveError}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Working Hours */}
        <div className="surface min-w-0 rounded-2xl p-5 sm:p-6 border border-[#E4EAF0] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E4EAF0] pb-3">
            <span className="w-8 h-8 rounded-xl bg-[#EAF2F8] text-[#4C83B5] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-[#123B59]">
              Jadwal Waktu Sesi Pelatihan
            </h2>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-[#123B59] font-bold mb-1.5">
                Jam Mulai Masuk
              </label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]"
                required
              />
              <span className="text-[11px] text-[#6F7F8D] mt-1 block">Waktu check-in resmi (09:00 WIB)</span>
            </div>

            <div>
              <label className="block text-[#123B59] font-bold mb-1.5">
                Batas Toleransi Terlambat
              </label>
              <input
                type="time"
                value={lateLimitTime}
                onChange={e => setLateLimitTime(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#C05621] font-bold outline-none focus:border-[#4C83B5]"
                required
              />
              <span className="text-[11px] text-[#6F7F8D] mt-1 block">Check-in setelah jam ini = Terlambat + pengurangan poin</span>
            </div>

            <div>
              <label className="block text-[#123B59] font-bold mb-1.5">
                Jam Selesai Pulang
              </label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]"
                required
              />
              <span className="text-[11px] text-[#6F7F8D] mt-1 block">Waktu check-out sesi berakhir</span>
            </div>
          </div>
        </div>

        {/* Location & GPS */}
        <div className="surface min-w-0 rounded-2xl p-5 sm:p-6 border border-[#E4EAF0] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E4EAF0] pb-3">
            <span className="w-8 h-8 rounded-xl bg-[#EAF2F8] text-[#4C83B5] flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-[#123B59]">
              Lokasi Kampus / Balai Pelatihan
            </h2>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-[#123B59] font-bold mb-1.5">
                Nama Gedung / Kampus Pelatihan
              </label>
              <input
                type="text"
                value={locationName}
                onChange={e => setLocationName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]"
                required
              />
            </div>

            <div>
              <label className="block text-[#123B59] font-bold mb-1.5">
                Radius Geofence (Meter)
              </label>
              <input
                type="number"
                value={radiusMeters}
                onChange={e => setRadiusMeters(Number(e.target.value))}
                min={10}
                max={5000}
                className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]"
                required
              />
            </div>
            <div>
              <label className="block text-[#123B59] font-bold mb-1.5">Latitude Kampus</label>
              <input type="number" step="any" value={officeLat} onChange={e => setOfficeLat(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]" required />
            </div>
            <div>
              <label className="block text-[#123B59] font-bold mb-1.5">Longitude Kampus</label>
              <input type="number" step="any" value={officeLng} onChange={e => setOfficeLng(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-[#E4EAF0] bg-[#F8FAFB] text-[#123B59] font-bold outline-none focus:border-[#4C83B5]" required />
            </div>
            <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => {
                if (!navigator.geolocation) { setLocationError('Perangkat ini tidak mendukung GPS.'); return; }
                setLocationError('');
                navigator.geolocation.getCurrentPosition(position => {
                  setOfficeLat(Number(position.coords.latitude.toFixed(6)));
                  setOfficeLng(Number(position.coords.longitude.toFixed(6)));
                }, () => setLocationError('Lokasi kampus tidak terdeteksi. Izinkan akses GPS saat berada di Punya Skill Akademi, Bandung.'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
              }} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[#C8DCEB] bg-[#EEF6FB] px-3 py-2.5 text-left font-bold text-[#28618F]">
                <LocateFixed className="h-4 w-4 shrink-0" /> Ambil pin GPS kampus dari lokasi saat ini
              </button>
              <a className="text-xs font-semibold text-[#28618F] hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${officeLat},${officeLng}`}>Cek pin di Google Maps</a>
              {locationError && <p role="alert" className="w-full text-xs font-semibold text-[#B84469]">{locationError}</p>}
              <p className="w-full text-[11px] leading-relaxed text-[#6F7F8D]">Admin perlu mengatur pin ini satu kali saat berada tepat di lokasi Punya Skill Akademi. Presensi WFO memakai pin ini dengan radius 100 m.</p>
            </div>
          </div>
        </div>

        {/* Hierarchical Verification Info Card */}
        <div className="surface min-w-0 rounded-2xl p-5 sm:p-6 border border-[#E4EAF0] space-y-3">
          <div className="flex items-center gap-2 border-b border-[#E4EAF0] pb-3">
            <span className="w-8 h-8 rounded-xl bg-[#EAF2F8] text-[#4C83B5] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-[#123B59]">
              Skema Verifikasi Bertingkat
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#F8FAFB] border border-[#E4EAF0] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#123B59]">
                <GraduationCap className="w-4 h-4 text-[#4C83B5]" />
                <span>Mentor Memverifikasi Trainee</span>
              </div>
              <p className="text-[11px] text-[#6F7F8D] leading-relaxed">
                Trainee melakukan presensi mandiri, lalu mentor kejuruan memeriksa dan menyetujui kehadiran peserta di kelasnya.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFB] border border-[#E4EAF0] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#123B59]">
                <UserCheck className="w-4 h-4 text-[#28618F]" />
                <span>Admin Memverifikasi Mentor</span>
              </div>
              <p className="text-[11px] text-[#6F7F8D] leading-relaxed">
                Mentor melakukan presensi instruktur harian, lalu administrator memvalidasi kehadiran mentor seluruh kejuruan.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => {
              if (confirm('Muat ulang seluruh data dari database TiDB?')) {
                resetToDefaultData();
              }
            }}
            className="rounded-xl border border-[#E3C4D0] bg-[#FCF3F6] hover:bg-[#fae3ec] px-4 py-2 text-xs font-bold text-[#B84469] transition cursor-pointer"
          >
            Muat Ulang Data TiDB
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#123B59] hover:bg-[#0D2F47] text-white text-xs font-bold transition cursor-pointer shadow-sm hover:-translate-y-0.5 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
