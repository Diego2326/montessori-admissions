"use client";

import { useState } from "react";
import type { LegacyContractAssignment } from "@/lib/operations/types";

export function LegacyContractsPanel({
  contracts,
  search,
  openableStudentIds,
  onOpenStudent,
}: {
  contracts: LegacyContractAssignment[];
  search: string;
  openableStudentIds: Set<number>;
  onOpenStudent: (studentId: number) => void;
}) {
  const [limit, setLimit] = useState(60);
  const filtered = contracts.filter((contract) =>
    `${contract.studentName} ${contract.representativeName} ${contract.contractId}`
      .toLocaleLowerCase("es")
      .includes(search.toLocaleLowerCase("es")),
  );

  return (
    <>
      <div className="contract-archive-grid">
        {filtered.slice(0, limit).map((contract) => (
          <article className="contract-archive-card" key={contract.contractId}>
            <div className="contract-archive-top">
              <span>Contrato #{contract.contractId}</span>
              <span>{contract.contractDate}</span>
            </div>
            <strong>{contract.studentName}</strong>
            <p>Representante: {contract.representativeName}</p>
            <div className="contract-archive-foot">
              <span className={`status-pill ${contract.matchedStudentId ? "success" : "waiting"}`}>
                {contract.matchedStudentId ? "Vinculado" : "Por identificar"}
              </span>
              {contract.matchedStudentId && openableStudentIds.has(contract.matchedStudentId) && (
                <button className="button button-soft" type="button" onClick={() => onOpenStudent(contract.matchedStudentId!)}>
                  Abrir alumno
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {filtered.length === 0 && <div className="empty-state"><h3>Sin contratos para esta búsqueda</h3></div>}
      {filtered.length > limit && (
        <button className="button button-soft contract-more" type="button" onClick={() => setLimit((value) => value + 60)}>
          Mostrar más ({filtered.length - limit})
        </button>
      )}
    </>
  );
}
