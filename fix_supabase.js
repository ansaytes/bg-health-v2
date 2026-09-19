const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      results.push(file);
    }
  });
  return results;
}

const files = walk('src/app/api');

files.forEach(file => {
  if (file.endsWith('.ts')) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace empty url
    content = content.replace(
      /const supabaseUrl = process\.env\.NEXT_PUBLIC_SUPABASE_URL \|\| '';/g,
      "const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';"
    );
    
    // Replace empty anon key
    content = content.replace(
      /const supabaseAnonKey = process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY \|\| '';/g,
      "const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';"
    );
    
    fs.writeFileSync(file, content);
  }
});
console.log('Fixed all empty supabase defaults!');
