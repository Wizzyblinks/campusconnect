import { useCallback, useEffect, useState } from "react";
import {
  MapPin,
  Phone,
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiRequest } from "./services/api.js";

const serviceCategories = [
  "Barber",
  "Tailoring",
  "Laundry",
  "Printing and Photocopying",
  "Phone and Computer Repairs",
  "Food and Catering",
  "Shops and Provisions",
  "Other",
];

const emptyForm = {
  name: "",
  category: serviceCategories[0],
  description: "",
  provider: "",
  phone: "",
  address: "",
  active: true,
};

const telephoneLink = (phone) => `tel:${phone.replace(/[^\d+]/g, "")}`;

function ServiceCard({ service }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {service.imageUrl && (
        <img
          src={service.imageUrl}
          alt={service.name}
          className="h-44 w-full object-cover"
          loading="lazy"
        />
      )}
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
              {service.category}
            </span>
            <h3 className="mt-3 text-lg font-extrabold text-slate-900">
              {service.name}
            </h3>
          </div>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {service.description}
        </p>
        <p className="mt-4 text-sm font-semibold text-slate-800">
          {service.provider}
        </p>
        <a
          href={telephoneLink(service.phone)}
          className="mt-1 inline-block text-sm text-slate-600 hover:text-blue-700"
        >
          {service.phone}
        </a>
        <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
          <MapPin size={17} className="mt-0.5 shrink-0 text-blue-700" />
          <span>{service.address}</span>
        </p>
        <a
          href={telephoneLink(service.phone)}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
        >
          <Phone size={17} />
          Call {service.provider}
        </a>
      </div>
    </article>
  );
}

export function CampusServices() {
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    const query = params.toString();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiRequest(
          `/api/services${query ? `?${query}` : ""}`,
          { signal: controller.signal },
        );
        if (!cancelled) {
          setServices(Array.isArray(data.services) ? data.services : []);
        }
      } catch (requestError) {
        if (!cancelled && requestError.name !== "AbortError") {
          setError(requestError.message || "Could not load campus services.");
          setServices([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, search]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">
          Around your campus
        </p>
        <h3 className="mt-2 text-2xl font-extrabold sm:text-3xl">
          Campus Services
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
          Find trusted local services, businesses, and everyday essentials
          around your campus.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search names, services, or locations"
            className="min-w-0 flex-1 text-sm outline-none"
          />
        </label>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter services by category"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="">All categories</option>
          {serviceCategories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading campus services...
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      {!loading && !error && services.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <MapPin size={34} className="mx-auto text-blue-600" />
          <h3 className="mt-3 font-extrabold">No services found</h3>
          <p className="mt-2 text-sm text-slate-500">
            Try another search or category, or check back later.
          </p>
        </div>
      )}
      {!loading && !error && services.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service._id} service={service} />
          ))}
        </div>
      )}
    </section>
  );
}

export function CampusServicesAdmin() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState(null);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/api/services/admin");
      setServices(Array.isArray(data.services) ? data.services : []);
      setAuthorized(true);
    } catch (requestError) {
      setError(requestError.message || "Could not load service records.");
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  function resetForm() {
    setForm(emptyForm);
    setImage(null);
    setEditingId("");
  }

  function editService(service) {
    setEditingId(service._id);
    setImage(null);
    setForm({
      name: service.name,
      category: service.category,
      description: service.description,
      provider: service.provider,
      phone: service.phone,
      address: service.address,
      active: service.active,
    });
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveService(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) =>
      body.append(key, String(value)),
    );
    if (image) body.append("image", image);
    try {
      const data = await apiRequest(
        editingId ? `/api/services/${editingId}` : "/api/services",
        { method: editingId ? "PATCH" : "POST", body },
      );
      setNotice(data.message || "Campus service saved.");
      resetForm();
      await loadServices();
    } catch (requestError) {
      setError(requestError.message || "Could not save the campus service.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteService(service) {
    if (!window.confirm(`Delete "${service.name}"? This cannot be undone.`)) {
      return;
    }
    setError("");
    setNotice("");
    try {
      const data = await apiRequest(`/api/services/${service._id}`, {
        method: "DELETE",
      });
      setNotice(data.message || "Campus service deleted.");
      if (editingId === service._id) resetForm();
      await loadServices();
    } catch (requestError) {
      setError(requestError.message || "Could not delete the campus service.");
    }
  }

  async function toggleActive(service) {
    setError("");
    setNotice("");
    const body = new FormData();
    body.append("active", String(!service.active));
    try {
      const data = await apiRequest(`/api/services/${service._id}`, {
        method: "PATCH",
        body,
      });
      setNotice(data.message || "Service status updated.");
      await loadServices();
    } catch (requestError) {
      setError(requestError.message || "Could not update service status.");
    }
  }

  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
          Administration
        </p>
        <h3 className="mt-2 text-2xl font-extrabold">Campus Services</h3>
        <p className="mt-2 text-sm text-slate-500">
          Create and maintain the service directory for your campus.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {notice}
        </div>
      )}

      {!authorized && loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Checking administrator access...
        </div>
      )}
      {!authorized && !loading && error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <span>
            Service administration could not be loaded. Check administrator
            access and try again.
          </span>
          <button
            type="button"
            onClick={loadServices}
            className="rounded-lg bg-amber-900 px-3 py-2 font-bold text-white hover:bg-amber-950"
          >
            Retry
          </button>
        </div>
      )}
      {authorized && (
        <>
      <form
        onSubmit={saveService}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-lg font-extrabold">
            {editingId ? "Edit service" : "Add a service"}
          </h4>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              <X size={16} /> Cancel edit
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Service name *
            <input required maxLength={100} value={form.name} onChange={setField("name")} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-semibold">
            Category *
            <select required value={form.category} onChange={setField("category")} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal">
              {serviceCategories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Provider/business name *
            <input required maxLength={100} value={form.provider} onChange={setField("provider")} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-semibold">
            Contact phone *
            <input required type="tel" maxLength={20} value={form.phone} onChange={setField("phone")} placeholder="+234 800 000 0000" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Physical address or campus location *
            <input required maxLength={200} value={form.address} onChange={setField("address")} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Description *
            <textarea required maxLength={1000} rows={3} value={form.description} onChange={setField("description")} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 font-normal" />
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 accent-blue-700" />
            Active and visible to students
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700">
            <Upload size={17} />
            {image ? image.name : "Optional service image"}
            <input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] || null)} className="sr-only" />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            "Saving..."
          ) : editingId ? (
            "Save changes"
          ) : (
            <><Plus size={17} /> Create service</>
          )}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-lg font-extrabold">All service records</h4>
          <button type="button" onClick={loadServices} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
            Refresh
          </button>
        </div>
        {loading && <p className="py-8 text-center text-sm text-slate-500">Loading services...</p>}
        {!loading && services.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No services have been added yet.</p>}
        {!loading && services.length > 0 && (
          <div className="mt-4 divide-y divide-slate-100">
            {services.map((service) => (
              <article key={service._id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {service.imageUrl ? (
                    <img src={service.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><MapPin size={20} /></div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-bold">{service.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{service.category} · {service.provider} · {service.active ? "Active" : "Inactive"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => toggleActive(service)} className={`rounded-lg px-3 py-2 text-xs font-bold ${service.active ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>
                    {service.active ? "Deactivate" : "Activate"}
                  </button>
                  <button type="button" onClick={() => editService(service)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                    <Pencil size={14} /> Edit
                  </button>
                  <button type="button" onClick={() => deleteService(service)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </section>
  );
}
