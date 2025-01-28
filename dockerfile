# Použijte oficiální Node.js image jako základ
FROM node:14-buster

# Nastavte pracovní adresář v kontejneru
WORKDIR /usr/src/app

# Zkopírujte package.json a package-lock.json do pracovního adresáře
COPY package*.json ./

# Nainstalujte závislosti
RUN npm install

# Zkopírujte zbytek zdrojového kódu do pracovního adresáře
COPY . .

# Exponujte port, na kterém aplikace běží
EXPOSE 5000

# Definujte příkaz pro spuštění aplikace
CMD ["npm", "start"]