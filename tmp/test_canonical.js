const getCanonicalPhone = (phone) => {
  if (!phone) return null;
  let digits = String(phone).replace(/[^0-9]/g, '');
  let len = digits.length;
  if (len < 10) return digits; // Fallback se for muito curto
  
  let core = digits.slice(-8); // últimos 8 dígitos
  let ddd;
  if (len % 2 !== 0) { // ímpares (tem 9º dígito): 11, 13
      ddd = digits.slice(-11, -9);
  } else { // pares (sem 9º dígito): 10, 12
      ddd = digits.slice(-10, -8);
  }
  return `${ddd}${core}`;
};

console.log("690198827516149:", getCanonicalPhone("690198827516149"));
console.log("553384051443:", getCanonicalPhone("553384051443"));
