
import { useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Wrench,
} from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";
import { exportCSVSimple } from "../../lib/utils";
import { generateReportPDF } from "../../lib/pdf";
import {
  PageHeader,
  Button,
  Card,
  Table,
  TableRow,
  Td,
  EmptyState,
  Modal,
  Input,
  Textarea,
  ExportDropdown,
} from "../../components/ui";
import type { Service } from "../../types";

const emptyForm = (): Omit<
  Service,
  "id" | "created_at"
> => ({
  name: "",
  description: "",
  default_price: null,
});

export default function ServicesPage() {
  const {
    services,
    addService,
    updateService,
    deleteService,
    settings,
    loading: dataLoading,
  } = useData();

  const { success, error } = useToast();

  const currency = settings?.currency_symbol || settings?.currency || 'LKR';

  const [showModal, setShowModal] =
    useState(false);

  const [editing, setEditing] =
    useState<Service | null>(null);

  const [form, setForm] =
    useState(emptyForm());

  const [deleteId, setDeleteId] =
    useState<string | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [validationError, setValidationError] =
    useState("");

  /* ---------------------------------------------------------------------- */
  /* New service                                                             */
  /* ---------------------------------------------------------------------- */

  const openNew = () => {
    setForm(emptyForm());
    setEditing(null);
    setValidationError("");
    setShowModal(true);
  };

  /* ---------------------------------------------------------------------- */
  /* Edit service                                                            */
  /* ---------------------------------------------------------------------- */

  const openEdit = (service: Service) => {
    setForm({
      name: service.name ?? "",
      description: service.description ?? "",
      default_price:
        service.default_price ?? null,
    });

    setEditing(service);
    setValidationError("");
    setShowModal(true);
  };

  /* ---------------------------------------------------------------------- */
  /* Close modal                                                             */
  /* ---------------------------------------------------------------------- */

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditing(null);
    setForm(emptyForm());
    setValidationError("");
  };

  /* ---------------------------------------------------------------------- */
  /* Save service                                                            */
  /* ---------------------------------------------------------------------- */

  const handleSave = async () => {
    const serviceName = form.name.trim();

    if (!serviceName) {
      setValidationError(
        "Service name is required."
      );
      return;
    }

    if (
      form.default_price !== null &&
      (Number.isNaN(form.default_price) ||
        form.default_price < 0)
    ) {
      setValidationError(
        "Default price must be a valid positive amount."
      );
      return;
    }

    setSaving(true);
    setValidationError("");

    try {
      const payload = {
        name: serviceName,
        description:
          form.description.trim(),
        default_price:
          form.default_price,
      };

      if (editing) {
        await updateService(
          editing.id,
          payload
        );

        success("Service updated.");
      } else {
        await addService(payload);

        success("Service created.");
      }

      closeModal();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : editing
            ? "Unable to update service."
            : "Unable to create service.";

      error(message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Delete service                                                          */
  /* ---------------------------------------------------------------------- */

  const handleDelete = async (
    id: string
  ) => {
    setDeleting(true);

    try {
      await deleteService(id);

      success("Service deleted.");
      setDeleteId(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to delete service.";

      error(message);
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Export PDF & CSV                                                       */
  /* ---------------------------------------------------------------------- */

  const handleExportPDF = () => {
    if (services.length === 0) {
      error("No services to export.");
      return;
    }

    try {
      generateReportPDF(
        "Services Catalog",
        `Showing ${services.length} service offering${services.length !== 1 ? "s" : ""}`,
        ["Service Name", "Description", "Default Price"],
        services.map((s) => [
          s.name || "—",
          s.description || "—",
          s.default_price !== null && s.default_price !== undefined
            ? `${currency} ${Number(s.default_price).toLocaleString()}`
            : "Custom Pricing",
        ]),
        [
          { label: "Total Services", value: `${services.length}` },
        ],
        settings
      );
      success(`Exported ${services.length} service${services.length !== 1 ? "s" : ""} to PDF.`);
    } catch (err) {
      console.error("Failed to export services PDF:", err);
      error("Failed to generate services PDF.");
    }
  };

  const handleExportCSV = () => {
    if (services.length === 0) {
      error("No services to export.");
      return;
    }

    try {
      exportCSVSimple(
        "services-catalog",
        ["Service Name", "Description", "Default Price"],
        services.map((s) => ({
          name: s.name || "",
          description: s.description || "",
          price: s.default_price !== null && s.default_price !== undefined ? Number(s.default_price) : "",
        }))
      );
      success(`Exported ${services.length} service${services.length !== 1 ? "s" : ""} to CSV.`);
    } catch (err) {
      console.error("Failed to export services CSV:", err);
      error("Failed to export services CSV.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle={`${services.length} service types`}
        actions={
          <>
            <ExportDropdown
              onExportPDF={handleExportPDF}
              onExportCSV={handleExportCSV}
              disabled={services.length === 0 || dataLoading}
            />

            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={openNew}
              disabled={dataLoading}
            >
              New Service
            </Button>
          </>
        }
      />

      {/* Services table */}
      <Card>
        {dataLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-sm text-xp-muted">
              <div
                className="
                  h-4
                  w-4
                  rounded-full
                  border-2
                  border-xp-purple/20
                  border-t-xp-purple
                  animate-spin
                "
              />

              Loading services...
            </div>
          </div>
        ) : services.length === 0 ? (
          <EmptyState
            title="No services"
            description="Add your service offerings."
            action={{
              label: "Add Service",
              onClick: openNew,
            }}
            icon={Wrench}
          />
        ) : (
          <Table
            headers={[
              "Service",
              "Description",
              "Default Price",
              "Actions",
            ]}
          >
            {services.map((service) => (
              <TableRow key={service.id}>
                <Td>
                  <p className="font-medium text-[#111]">
                    {service.name}
                  </p>
                </Td>

                <Td>
                  <p className="text-sm text-xp-muted max-w-xs truncate">
                    {service.description ||
                      "—"}
                  </p>
                </Td>

                <Td>
                  <span className="text-sm font-medium text-[#111]">
                    {service.default_price !=
                    null
                      ? `LKR ${service.default_price.toLocaleString()}`
                      : "—"}
                  </span>
                </Td>

                <Td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        openEdit(service)
                      }
                      className="
                        p-1.5
                        rounded-md
                        text-xp-muted
                        hover:text-[#111]
                        hover:bg-xp-light-gray
                      "
                      aria-label="Edit service"
                    >
                      <Edit2 size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteId(
                          service.id
                        )
                      }
                      className="
                        p-1.5
                        rounded-md
                        text-xp-muted
                        hover:text-red-600
                        hover:bg-red-50
                      "
                      aria-label="Delete service"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </Td>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>

      {/* Create / Edit modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={
          editing
            ? "Edit Service"
            : "New Service"
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={() => {
                void handleSave();
              }}
              disabled={saving}
            >
              {saving
                ? editing
                  ? "Saving..."
                  : "Creating..."
                : editing
                  ? "Save"
                  : "Create"}
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          {validationError && (
            <div
              role="alert"
              className="
                rounded-lg
                border
                border-red-200
                bg-red-50
                px-4
                py-2.5
                text-sm
                text-red-600
              "
            >
              {validationError}
            </div>
          )}

          <Input
            label="Service Name"
            value={form.name}
            onChange={(event) => {
              setForm((previous) => ({
                ...previous,
                name: event.target.value,
              }));

              if (validationError) {
                setValidationError("");
              }
            }}
            placeholder="Website Development"
            disabled={saving}
          />

          <Textarea
            label="Description"
            value={form.description}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                description:
                  event.target.value,
              }))
            }
            placeholder="Brief description..."
            disabled={saving}
          />

          <Input
            label="Default Price (LKR)"
            type="number"
            min="0"
            step="0.01"
            value={
              form.default_price ?? ""
            }
            onChange={(event) => {
              const value =
                event.target.value;

              setForm((previous) => ({
                ...previous,
                default_price:
                  value === ""
                    ? null
                    : Number(value),
              }));

              if (validationError) {
                setValidationError("");
              }
            }}
            placeholder="0"
            disabled={saving}
          />
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteId}
        onClose={() => {
          if (!deleting) {
            setDeleteId(null);
          }
        }}
        title="Delete Service"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteId(null)
              }
              disabled={deleting}
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              onClick={() => {
                if (deleteId) {
                  void handleDelete(
                    deleteId
                  );
                }
              }}
              disabled={deleting}
            >
              {deleting
                ? "Deleting..."
                : "Delete"}
            </Button>
          </>
        }
      >
        <div className="p-6">
          <p className="text-sm text-xp-muted">
            This will delete the service
            type. If the service is already
            being used by projects, the
            database may prevent deletion to
            protect existing records.
          </p>
        </div>
      </Modal>
    </div>
  );
}
