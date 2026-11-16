import React, { useCallback, useEffect, useState } from "react";
import { Button, Tooltip } from "@material-ui/core";
import { Android } from "@material-ui/icons";

import api from "../../services/api";
import toastError from "../../errors/toastError";

// Botón para prender/apagar el bot de IA en esta conversación.
// No se muestra si el bot no está configurado o si el ticket es de un grupo.
const BotToggle = ({ ticketId }) => {
	const [estado, setEstado] = useState(null);
	const [cargando, setCargando] = useState(false);

	const cargar = useCallback(async () => {
		try {
			const { data } = await api.get(`/tickets/${ticketId}/bot`);
			setEstado(data);
		} catch (err) {
			setEstado(null);
		}
	}, [ticketId]);

	useEffect(() => {
		setEstado(null);
		cargar();
		// El bot puede pausarse solo (derivación, Rodrigo escribió): se refresca cada 20 s.
		const intervalo = setInterval(cargar, 20000);
		return () => clearInterval(intervalo);
	}, [cargar]);

	if (!estado?.disponible) return null;

	// El bot está apagado para todos (BOT_ACTIVO=false en el servicio del bot).
	if (estado.botGlobalActivo === false) {
		return (
			<Tooltip title="El bot está apagado para todas las conversaciones (BOT_ACTIVO=false).">
				<span>
					<Button size="small" variant="outlined" startIcon={<Android />} disabled>
						Bot apagado
					</Button>
				</span>
			</Tooltip>
		);
	}

	const cambiar = async () => {
		setCargando(true);
		try {
			const { data } = await api.put(`/tickets/${ticketId}/bot`, {
				activo: !estado.activo,
			});
			setEstado(data);
		} catch (err) {
			toastError(err);
		}
		setCargando(false);
	};

	const ayuda = estado.activo
		? "El bot responde en esta conversación. Clic para apagarlo."
		: `Bot en pausa${estado.motivo ? `: ${estado.motivo}` : ""}. Clic para encenderlo.`;

	return (
		<Tooltip title={ayuda}>
			<span>
				<Button
					size="small"
					variant={estado.activo ? "contained" : "outlined"}
					style={estado.activo ? { background: "#2e7d32", color: "#fff" } : undefined}
					startIcon={<Android />}
					disabled={cargando}
					onClick={cambiar}
				>
					{estado.activo ? "Bot activo" : "Bot en pausa"}
				</Button>
			</span>
		</Tooltip>
	);
};

export default BotToggle;
