---
applyTo: "apps/**/src/**/*.spec.ts,apps/**/test/**,packages/**/*.test.ts,packages/**/*.spec.ts"
---

# Pruebas Zapi V2

- Probar fronteras y riesgos, no detalles de implementación sin valor.
- UI: estados, permisos e interacción principal; usar fixtures deterministas y MSW cuando aplique.
- API: validación, ownership, autorización, errores e idempotencia.
- Worker: reintentos, duplicados, transiciones de estado y fallos parciales.
- No depender de servicios externos inestables en CI; usar adapters o clientes simulados.
- Ampliar la cobertura solo cuando cambie comportamiento compartido o exista riesgo de regresión.
