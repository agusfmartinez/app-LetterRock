import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const ConfirmContext = createContext(null)

/**
 * Confirmación de acciones destructivas.
 *
 * Devuelve una promesa de `true`/`false`, igual que `window.confirm` devolvía un
 * booleano, así que en el llamador sólo cambia el `await`:
 *
 *   if (!(await confirm({ message: '¿Borrar esto?' }))) return
 *
 * Va por contexto y no como estado local de cada pantalla porque son ocho
 * lugares distintos: con estado local, cada uno tendría que declarar su propio
 * `open`, su mensaje y su callback pendiente, y el diálogo terminaría dibujado
 * ocho veces con ocho variantes de estilo.
 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm necesita estar dentro de <ConfirmProvider>')
  return confirm
}

function Dialog({ request, onResolve }) {
  const cancelRef = useRef(null)

  // El foco arranca en Cancelar y no en Borrar: si alguien llega acá tecleando,
  // que el Enter no confirme una acción que no se puede deshacer.
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onResolve(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onResolve])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => onResolve(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={request.title || 'Confirmar'}
        // Sin esto, el click en la tarjeta llega al fondo y cierra el diálogo.
        onClick={e => e.stopPropagation()}
        className="bg-rock-card border border-rock-border rounded-lg p-5 max-w-sm w-full space-y-4 shadow-xl"
      >
        {request.title && (
          <h2 className="text-rock-text font-bold">{request.title}</h2>
        )}
        <p className="text-gray-300 text-sm leading-relaxed">{request.message}</p>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            ref={cancelRef}
            onClick={() => onResolve(false)}
            className="text-sm text-gray-400 hover:text-rock-text px-3 py-1.5"
          >
            {request.cancelLabel || 'Cancelar'}
          </button>
          <button
            onClick={() => onResolve(true)}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded text-sm font-semibold"
          >
            {request.confirmLabel || 'Borrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)

  const confirm = useCallback(
    (options) =>
      new Promise(resolve => {
        const base = typeof options === 'string' ? { message: options } : options
        setRequest({ ...base, resolve })
      }),
    []
  )

  const resolve = useCallback((value) => {
    setRequest(current => {
      current?.resolve(value)
      return null
    })
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {/* `key` remonta el diálogo en cada pedido: así el foco vuelve a Cancelar
          aunque se abran dos seguidos. */}
      {request && <Dialog key={request.message} request={request} onResolve={resolve} />}
    </ConfirmContext.Provider>
  )
}
