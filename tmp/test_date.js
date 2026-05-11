const { format } = require('date-fns');
const { ptBR } = require('date-fns/locale');

const dateString = "2026-05-11T00:55:19.088748+00:00";
const dataSemFuso = dateString.substring(0, 19);
console.log(dataSemFuso);
const parsed = new Date(dataSemFuso);
console.log(format(parsed, 'dd/MM/yyyy HH:mm', { locale: ptBR }));
