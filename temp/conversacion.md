# **Integrar Codebase Memory con Zed**

[https://gemini.google.com/app/d5dbd8f7dbac6e2b](https://gemini.google.com/app/d5dbd8f7dbac6e2b)

*User prompt: Como funciona esto y como lo usaría con mi IDE de Zed para programar mi proximo proyecto y dejar de usar knowledge context pq son muchos .md que uso y que gasta muchos tokens*

## **Response: Arquitectura y Funcionamiento Técnico**

**codebase-memory-mcp** es un servidor estático de protocolo MCP (Model Context Protocol) escrito en C que analiza y mapea código mediante parsing AST (Abstract Syntax Tree) utilizando **Tree-Sitter**.

`[Código Fuente] ---> [Tree-Sitter AST] ---> [Extracción de Símbolos/Grafo] ---> [SQLite Local (CBM)] <---> [Agente IA en Zed]`

### **¿Cómo opera internamente?**

> 1. **Parsing estático multi-lenguaje:** En lugar de leer texto plano, procesa el código usando gramáticas nativas para identificar funciones, clases, interfaces, tipos, importaciones y llamadas.  
> 2. **Grafo de conocimiento local:** Genera un grafo de relaciones (quién llama a quién, qué hereda de qué, dónde se usa un tipo o interfaz) y lo persiste en una base de datos local SQLite comprimida con LZ4.  
> 3. **Reducción de consumo de tokens:**  
   * **Método tradicional (Ficheros .md / Knowledge Context):** Inyecta archivos enteros o contexto continuo en la ventana de contexto del LLM en cada turno, gastando de decenas a cientos de miles de tokens de entrada.  
   * **Método con MCP:** El modelo realiza consultas estructuradas puntuales a la base de datos local (ej. *¿qué funciones llaman a X?* o *¿cuál es la firma de Y?*). En lugar de leer miles de líneas, el servidor devuelve únicamente los nodos y enlaces relevantes, reduciendo el consumo de tokens hasta en un **90% \- 99%**.

## **Instalación y Configuración con Zed IDE**

### **Paso 1: Instalación del servidor binario**

Ejecuta el instalador en tu sistema operativo para obtener el ejecutable binario:

> * **Linux / macOS:**  
>   `curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash`

> * **Windows (PowerShell):**  
>   `irm https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1 | iex`

*Verifica que el ejecutable codebase-memory-mcp esté disponible en tu PATH ejecutando codebase-memory-mcp \--version en la terminal.*

### **Paso 2: Registrar el servidor MCP en Zed IDE**

> 1. Abre Zed IDE.  
> 2. Abre la paleta de comandos (Cmd+Shift+P en macOS o Ctrl+Shift+P en Linux/Windows) y selecciona **zed: open settings** (esto abrirá tu archivo settings.json de Zed).  
> 3. Añade la configuración del servidor MCP dentro de la clave "context\_servers":

`{`  
  `"context_servers": {`  
    `"codebase-memory": {`  
      `"command": {`  
        `"path": "codebase-memory-mcp",`  
        `"args": []`  
      `}`  
    `}`  
  `}`  
`}`

**Nota:** Si el ejecutable no está en el PATH global de tu sistema, escribe la ruta absoluta hacia el binario (ej. "/usr/local/bin/codebase-memory-mcp" o "C:\\\\Users\\\\Usuario\\\\.cargo\\\\bin\\\\codebase-memory-mcp.exe").

### **Paso 3: Confirmación en Zed**

Para validar que Zed detectó e inició el servidor:

> 1. Ve a **Settings → AI → MCP Servers** dentro de Zed.  
> 2. Comprueba que el servidor **codebase-memory** aparezca con un punto **verde** e indicativo de estado activo.

## **Flujo de Trabajo para tu Próximo Proyecto**

Para prescindir del uso masivo de archivos .md de contexto:

> 1. **Abre tu proyecto en Zed.**  
> 2. **Indexación inicial:** Abre el panel de agente de IA en Zed y solicita al modelo:*"Indexa este proyecto"* / *"Index this project"*  
> 3. **Automatización:** Si deseas que indexe cualquier proyecto automáticamente al abrirlo, ejecuta en la terminal:  
>    `codebase-memory-mcp config set auto_index true`

> 4. **Uso diario sin adjuntar .md:**  
   * En lugar de pegar documentación o archivos de contexto, pregúntale directamente al asistente cosas como:  
     * *"¿Cuál es la cadena de llamadas de la función X?"*  
     * *"¿Qué impacto tendría cambiar la interfaz Y?"*  
     * *"Muestra los módulos principales y rutas del proyecto."*  
   * El modelo llamará automáticamente a las herramientas MCP (search\_graph, get\_call\_chain, etc.) detrás de escena, leyendo la estructura exacta en milisegundos sin consumir innecesariamente la ventana de contexto.

---

*User prompt: Ok, consideras que esto sería un cambio y mejora drástica al usar arquitectura knowlegde context? Y que sería más barato? Que el agente podrá seguir con la conversación cuando ocurra los "/compact" por la limitación de la ventana de contexto, alucionaciones, inferencias porque el agente se olvida de ejecutar o pierde el hilo*

Response: Sí. Arquitectónicamente representa una **mejora drástica en la gestión de contexto y costo de inferencia**, aunque no elimina al 100% ciertos problemas inherentes al comportamiento de los LLMs.

## **1\. Impacto Económico y Consumo de Tokens**

### **Contexto Tradicional (.md / Carga manual de archivos)**

> * **Mecanismo:** Cada vez que envías un mensaje, se vuelcan archivos completos o resúmenes extensos dentro del *system prompt* o del historial.  
> * **Costos:** Pagas el costo de *input tokens* repetidamente por toda esa masa de texto en **cada turno del chat**. En proyectos medianos, esto representa entre 30,000 y 120,000 tokens por petición.  
> * **Escalabilidad:** Insostenible a medida que el proyecto crece.

### **Arquitectura MCP (codebase-memory-mcp)**

> * **Mecanismo:** El contexto del código no reside en la ventana del LLM; reside en una **base de datos SQLite/LZ4 local** fuera de la memoria del modelo.  
> * **Costos:** El prompt inicial solo contiene las definiciones de las herramientas MCP. El agente realiza consultas pequeñas y recibe únicamente los nodos o firmas de código que necesita en ese instante (200 \- 1,500 tokens).  
> * **Resultado:** Reducción del gasto operativo por API de un **80% a un 95%** dependiendo de la duración de la sesión.

## **2\. Comportamiento frente a la Compactación (/compact)**

Cuando una conversación alcanza el límite de la ventana de contexto y el editor ejecuta un /compact:

> * **En el enfoque .md:** El editor resume la conversación y elimina o degrada los fragmentos de código e instrucciones detalladas que habías adjuntado. Para que el agente recupere el nivel de precisión inicial, debes volver a adjuntar los archivos.  
> * **Con el MCP:** **El grafo de conocimiento no se destruye.** La base de datos AST permanece intacta en disco. Aunque la conversación se comprima a un resumen abstracto, la capacidad del agente para hacer un *lookup* determinista de tipos, funciones o dependencias se mantiene 100% intacta.

## **3\. Reducción de Alucinaciones e Inferencias Erróneas**

### **Lo que SÍ resuelve**

> * **Alucinaciones de sintaxis y firmas:** Las respuestas sobre firmas de métodos, tipos de retorno, archivos importados y cadenas de llamadas provienen de un *parsing* determinista estático (Tree-Sitter), no de la predicción probabilística de texto del modelo.  
> * **Ubicación exacta:** El modelo no "asume" en qué archivo está una función; consulta el índice y obtiene la ruta exacta del sistema de archivos.

### **Lo que NO resuelve (Límites de la arquitectura)**

> * **Pérdida de ejecución de herramientas:** Si tras un /compact el agente pierde la instrucción de usar el MCP, o si el modelo de lenguaje decide responder impulsivamente sin consultar sus herramientas (un fallo común cuando el modelo intenta ahorrar turnos), volverá a hacer inferencias a ciegas.  
> * **Lógica de negocio e intención humana:** Un AST entiende la estructura (*qué* código hay y *dónde* está), pero no el *porqué* técnico ni las reglas de negocio.

## **Comparativa de Arquitectura**

| Dimensión | Knowledge Context (.md / Inyección masiva) | Graph AST vía MCP (codebase-memory-mcp) |
| :---- | :---- | :---- |
| **Ubicación del código** | Dentro de la ventana de contexto (LLM Memory) | En base de datos SQLite local (Disco/RAM) |
| **Costo por turno** | Alto (escala con el tamaño de los .md) | Bajo (constante; solo paga la respuesta de la consulta) |
| **Resistencia a /compact** | Baja (se pierde el detalle técnico al resumir) | Alta (la base de datos externa no se altera) |
| **Precisión en tipos y AST** | Aproximada (depende de lo que el LLM recuerde) | Exacta (vía parsing determinista Tree-Sitter) |
| **Velocidad de respuesta** | Más rápida por turno (no realiza llamadas a herramientas) | Añade un turno extra de latencia (tool\_call) |

## **Estrategia Óptima Recomendada**

Para obtener la máxima integridad epistémica y costo mínimo:

> 1. **Usa el MCP para la estructura:** Deja que codebase-memory-mcp gestione automáticamente símbolos, archivos, importaciones, tipos y relaciones.  
> 2. **Conserva un .md mínimo (Opcional):** Si el proyecto tiene reglas de negocio complejas o convenciones no estandarizadas, mantén un único archivo AGENTS.md o ARCHITECTURE.md conciso (menos de 100 líneas) con las reglas de negocio globales.

De esta forma, delegas la memoria estructural y de código a la base de datos externa y dejas la ventana de contexto libre para el razonamiento activo.

---

*User prompt: ok, pero lo que mencionas de "Lo que NO resuelve (Límites de la arquitectura)" Cómo se podría arreglar? Usando un AGENTS.md arreglaría eso? Por ejemplo, siempre que necesite saber el estado de avance del proyecto, que SIEMPRE tendría que ejecutar el mcp para saber que hace, consultar incluso lo que mencionas de las reglas y el porque, porque se podría subir la documentacion que antes se usaba por ejemplo (imagen) y ahi que use el mcp*

Response: Sí, **esa es la solución exacta**. La combinación de **codebase-memory-mcp \+ AGENTS.md \+ una carpeta docs/ organizada** (como la que muestras en la imagen) forma una **Arquitectura Híbrida**.

Esta arquitectura resuelve las limitaciones de alucinación, olvido tras el /compact y falta de contexto de negocio, manteniendo el consumo de tokens en el mínimo posible.

## **¿Cómo soluciona esto los límites del modelo?**

### **1\. La carpeta docs/ como "Base de Conocimiento bajo demanda"**

Tu estructura actual (docs/conocimiento, docs/planes, docs/reglas) es excelente.

> * **El error anterior:** Cargar *todos* los .md en la memoria del chat en cada mensaje.  
> * **La solución Híbrida:** Los archivos .md viven en el disco. El agente **solo lee el archivo específico que necesita** cuando la pregunta lo requiere. Si preguntas sobre el avance de los canales, el agente solo lee docs/planes/channels-v2.md en ese turno y luego lo "olvida" de la memoria activa.

### **2\. AGENTS.md como el "Contrato de Comportamiento"**

AGENTS.md (o las instrucciones del sistema en Zed) actúa como el manual de operaciones del LLM. Le dice al agente **cómo pensar y qué herramientas usar** antes de responder.

Resuelve la pérdida de hilo tras un /compact o el olvido de ejecutar herramientas porque **las reglas del AGENTS.md se reinyectan o priorizan en el Prompt de Sistema**, recordando al modelo su protocolo de trabajo.

## **Ejemplo de AGENTS.md para tu Estructura**

Puedes crear un archivo AGENTS.md en la raíz de tu proyecto con una estructura similar a esta:

`# Protocolo de Trabajo del Agente`

`## 1. Inspección de Código (Estructura y Tipos)`  
``- Para entender el código, firmas de funciones, dependencias o tipos, usa SIEMPRE el servidor MCP `codebase-memory`.``   
`- NUNCA deduzcas la ubicación o firma de una función sin consultar el MCP.`

`## 2. Mapa de Conocimiento y Negocio (docs/)`  
`No cargues toda la documentación en memoria. Consulta bajo demanda según la intención del usuario:`

`- **Estado del proyecto y planes de desarrollo:**`   
  ``- Si el usuario pregunta por el estado de avance, características a implementar o roadmap, lee primero el archivo relevante en `docs/planes/` (ej. `implementacion-v2.md` o `channels-v2.md`).``  
`- **Reglas de diseño e interfaz:**`  
  ``- Antes de escribir o modificar componentes UI, lee `docs/reglas/design.md`.``  
`- **Arquitectura y Deployment:**`  
  ``- Consulta `docs/conocimiento/stack.md` o `docs/conocimiento/deployment/`.``

`## 3. Mantenimiento del Estado`  
``- Si completas una tarea o hito importante, actualiza el archivo correspondiente en `docs/planes/` para mantener el estado del proyecto al día.``

## **Comparación del Flujo de Trabajo**

`[Usuario pregunta por el avance del proyecto]`  
       `│`  
       `▼`  
`` [Agente lee AGENTS.md] ──► Sabe que debe consultar `docs/planes/` ``  
       `│`  
       `▼`  
``[Agente lee SOLO `docs/planes/implementacion-v2.md`] (Gasta ~1,000 tokens)``  
       `│`  
       `▼`  
`[Agente usa MCP para verificar qué código ya existe] (Gasta ~500 tokens)`  
       `│`  
       `▼`  
`[Respuesta precisa, basada en código real + documentación de planes]`

### **Resultados de esta arquitectura:**

> 1. **Gasto mínimo de tokens:** En lugar de 80,000 tokens por mensaje, gastas entre 2,000 y 4,000 tokens.  
> 2. **Sin alucinaciones de avance:** El estado de avance se lee del plan en docs/planes/ y se verifica con el grafo AST de codebase-memory-mcp.  
> 3. **Resistencia a /compact:** Aunque la conversación de chat se comprima, las reglas de AGENTS.md, la base de datos MCP y los archivos en docs/ permanecen intactos en el disco.

---
