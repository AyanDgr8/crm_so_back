// src/controllers/customers.js

import connectDB from '../db/index.js';  
// Function to check if a column already exists
const columnExists = async (connection, columnName) => {
  const query = `
      SELECT * FROM information_schema.COLUMNS 
      WHERE TABLE_NAME = 'customers' AND COLUMN_NAME = ?`;
  const [rows] = await connection.execute(query, [columnName]);
  return rows.length > 0;
};

// Function to add a new column to the customers table
const addColumnToCustomers = async (connection, fieldName, fieldType) => {
  const isValidColumnName = (name) => /^[a-zA-Z0-9_ ]+$/.test(name); // Allow spaces

  if (!isValidColumnName(fieldName)) {
    throw new Error(`Invalid column name: ${fieldName}`);
  }

  let columnType;
  switch (fieldType) {
    case 'text':
      columnType = 'VARCHAR(255)';
      break;
    case 'dropdown':
      columnType = 'TEXT';
      break;
    case 'dropdown_checkbox':
      columnType = 'TEXT';
      break;
    case 'datetime':
      columnType = 'DATETIME';
      break;
    default:
      throw new Error(`Unsupported field type: ${fieldType}`);
  }

  const alterTableQuery = `ALTER TABLE customers ADD COLUMN \`${fieldName}\` ${columnType}`;
  await connection.execute(alterTableQuery);
};

// Function to validate field types
const isValidFieldType = (fieldType) => {
  const validTypes = ['text', 'dropdown', 'datetime'];
  return validTypes.includes(fieldType);
};

// Function to insert a new custom field in 'custom_fields'
const insertCustomField = async (connection, fieldName, fieldType, dropdownOptions) => {
  const insertQuery = `
    INSERT INTO custom_field (field_name, field_type, dropdown_options) 
    VALUES (?, ?, ?)`;

  const options = dropdownOptions && dropdownOptions.length > 0 ? JSON.stringify(dropdownOptions) : null;

  await connection.execute(insertQuery, [fieldName, fieldType, options]);
};

// *****************

// Fetch all customers with custom fields
// export const getAllCustomers = async (req, res) => {
//   try {
//     const connection = await connectDB();

//     // Step 1: Fetch all custom field names
//     const customFieldsQuery = `
//       SELECT field_name 
//       FROM custom_field`;
//     const [customFieldsRows] = await connection.execute(customFieldsQuery);
    
//     // Step 2: Construct the dynamic SQL query
//     const customFieldColumns = customFieldsRows.map(cf => 
//       `MAX(CASE WHEN cf.field_name = '${cf.field_name}' THEN cfv.field_value END) AS \`${cf.field_name}\``
//     ).join(', ');

//     const query = `
//       SELECT c.id AS customer_id,
//              c.first_name,
//              c.last_name,
//              c.phone_no,
//              c.email_id,
//              c.date_of_birth,
//              c.address,
//              c.company_name,
//              c.company_unique_id,
//              c.contact_type,
//              c.source,
//              c.disposition,
//              c.agent_name,
//              c.date_created,
//              ${customFieldColumns}  -- Include dynamically constructed fields
//       FROM customers AS c
//       LEFT JOIN custom_field_values AS cfv ON c.company_unique_id = cfv.comp_unique_id
//       LEFT JOIN custom_field AS cf ON cfv.field_id = cf.id
//       GROUP BY c.id  -- Don't forget to group by customer ID
//       ORDER BY c.id;`;

//     const [rows] = await connection.execute(query);
    
//     res.status(200).json(rows);
//   } catch (error) {
//     console.error('Error fetching customers:', error);
//     res.status(500).json({ message: 'Failed to fetch records' });
//   }
// };

export const getAllCustomers = async (req, res) => {
  try {
      const connection = await connectDB();
      const query = `SELECT * FROM customers ORDER BY updated_at DESC`;  
      const [rows] = await connection.execute(query);
      
      res.status(200).json(rows);
  } catch (error) {
      console.error('Error fetching last updated customers:', error);
      res.status(500).json({ message: 'Failed to fetch records' });
  }
};

// Search for customers with custom fields
export const searchCustomers = async (req, res) => {
  const { query } = req.query;

  try {
    const connection = await connectDB();
    const searchParam = `%${query}%`;

    const sql = `
      SELECT c.id AS customer_id,
             c.first_name,
             c.last_name,
             c.phone_no,
             c.email_id,
             c.date_of_birth,
             c.address,
             c.company_name,
             c.company_unique_id,
             c.contact_type,
             c.source,
             c.disposition,
             c.agent_name,
             c.date_created,
             cf.field_name,
             cfv.field_value
      FROM customers AS c
      LEFT JOIN custom_field_values AS cfv ON c.company_unique_id = cfv.comp_unique_id
      LEFT JOIN custom_field AS cf ON cfv.field_id = cf.id
      WHERE c.first_name LIKE ? 
      OR c.last_name LIKE ? 
      OR c.phone_no LIKE ?
      OR c.email_id LIKE ?
      OR c.company_unique_id LIKE ?
      OR c.agent_name LIKE ?
      OR c.address LIKE ?
      OR c.contact_type LIKE ?
      OR c.company_name LIKE ?
      OR c.disposition LIKE ?
      ORDER BY c.id, cf.field_name;
    `;

    const [rows] = await connection.execute(sql, [
      searchParam,
      searchParam,
      searchParam,
      searchParam,
      searchParam,
      searchParam,
      searchParam,
      searchParam,
      searchParam,
      searchParam
    ]);

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({ message: 'Failed to search customers' });
  }
};

// *****************


// Update customer details including custom fields
export const updateCustomer = async (req, res) => {
  const company_unique_id = req.params.id;  // Keep this to identify the customer to update
  const { first_name, last_name, 
          phone_no, email_id, date_of_birth, 
          address, company_name, contact_type, 
          source, disposition, agent_name, custom_fields } = req.body;

  try {
    const connection = await connectDB(); 

    // Fetch existing customer data
    const [existingCustomer] = await connection.execute('SELECT * FROM customers WHERE company_unique_id = ?', [company_unique_id]);
    
    if (existingCustomer.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get the current date_of_birth value from the existing data
    const currentDOB = existingCustomer[0].date_of_birth;

    // Format the date_of_birth to 'YYYY-MM-DD' if it exists
    const formattedDOB = date_of_birth ? new Date(date_of_birth).toISOString().split('T')[0] : currentDOB;

    const query = `
      UPDATE customers 
      SET first_name = ?, last_name = ?, 
          phone_no = ?, email_id = ?, 
          date_of_birth = ?, address = ?, 
          company_name = ?, contact_type = ?, 
          source = ?, disposition = ?, 
          agent_name = ? 
      WHERE company_unique_id = ?`;

    const params = [
      first_name || null,
      last_name || null,
      phone_no || null,
      email_id || null,
      formattedDOB || null,
      address || null,
      company_name || null,
      contact_type || "customer",
      source || null,
      disposition || null,
      agent_name || null,
      company_unique_id,
    ];

    // Log params for debugging
    console.log('Updating customer with params:', params);

    await connection.execute(query, params);

    // Handle custom fields update
    if (custom_fields && Array.isArray(custom_fields)) {
      for (const field of custom_fields) {
        const { fieldId, fieldValue } = field;

        // Check if the custom field already exists for this customer
        const [existingField] = await connection.execute(
          'SELECT * FROM custom_field_values WHERE comp_unique_id = ? AND field_id = ?',
          [company_unique_id, fieldId]
        );

        if (existingField.length > 0) {
          // Update existing custom field value
          await connection.execute(
            'UPDATE custom_field_values SET field_value = ? WHERE comp_unique_id = ? AND field_id = ?',
            [fieldValue, company_unique_id, fieldId]
          );
        } else {
          // Insert new custom field value
          await connection.execute(
            'INSERT INTO custom_field_values (comp_unique_id, field_id, field_value) VALUES (?, ?, ?)',
            [company_unique_id, fieldId, fieldValue]
          );
        }
      }
    }

    res.status(200).json({ message: 'Customer updated successfully!' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ message: 'Failed to update customer' });
  }
};


// *****************

// Function to insert a change log
const insertChangeLog = async (connection, com_unique_id, changes) => {
  for (const change of changes) {
    const { field, old_value, new_value } = change; 

    // Prepare the insert query
    const changeLogQuery = `
      INSERT INTO updates_history ( com_unique_id, field, old_value, new_value, changed_at) 
      VALUES ( ?, ?, ?, ?, ?)`;

    // Execute the query
    await connection.execute(changeLogQuery, [
      com_unique_id,
      field,
      old_value || null, 
      new_value || null, 
      new Date(), // Current timestamp
    ]);
  }

  // Log changes for custom fields
  for (const customFieldChange of changes.filter(c => c.isCustomField)) {
    const { fieldId, old_value, new_value } = customFieldChange;

    // Insert the custom field change log
    await connection.execute(
      'INSERT INTO updates_history (com_unique_id, field, old_value, new_value, changed_at) VALUES (?, ?, ?, ?, ?)',
      [com_unique_id, `Custom Field ${fieldId}`, old_value, new_value, new Date()]
    );
  }
};


// *****************

// Function to fetch change history for a customer
const getChangeHistory = async (connection, company_unique_id) => {
  console.log(`Received company_unique_id: ${company_unique_id}`); 
  const fetchHistoryQuery = `
    SELECT * FROM updates_history 
    WHERE com_unique_id = ? 
    ORDER BY changed_at DESC`;

  const [changeHistory] = await connection.execute(fetchHistoryQuery, [company_unique_id]);
  return changeHistory;
};

// *****************

// Main function to handle logging and fetching change history
export const historyCustomer = async (req, res) => {
  const { company_unique_id, changes } = req.body; // Ensure changes is an array of change objects

  if (!company_unique_id || !Array.isArray(changes)) {
      return res.status(400).json({ message: 'Invalid request data' });
  }

  let connection;
  try {
      connection = await connectDB();

      // Insert change log entries
      await insertChangeLog(connection, company_unique_id, changes); // Pass changes directly

      // Fetch the change history for the customer
      const changeHistory = await getChangeHistory(connection, company_unique_id);

      res.status(200).json({
          message: 'Change history recorded successfully!',
          changeHistory,
      });
  } catch (error) {
      console.error('Error logging change history:', error);
      res.status(500).json({ message: 'Failed to log change history' });
  } finally {
    if (connection) {
        await connection.end(); // Ensure the connection is closed
    }
  }
};

// *****************

// Function to handle fetching change history
export const gethistoryCustomer = async (req, res) => {
  const company_unique_id = req.params.id;  // Use company_unique_id here
  console.log("Fetching change history for company_unique_id:", company_unique_id);

  try {
    const connection = await connectDB();

    // Fetch change history for the specified customer
    const changeHistory = await getChangeHistory(connection, company_unique_id);

    if (changeHistory.length === 0) {
      return res.status(404).json({ message: 'No change history found for this customer.' });
    }

    res.status(200).json({
      message: 'Change history retrieved successfully!',
      changeHistory,
    });
  } catch (error) {
    console.error('Error fetching change history:', error);
    res.status(500).json({ message: 'Failed to fetch change history' });
  }
};

// **********

export const deleteRecord = async (req, res) => {
  const customerId = req.params.id;

  try {
    const result = await db.query('DELETE FROM customers WHERE id = ?', [customerId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    res.status(200).json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({ message: 'An error occurred while deleting the record' });
  }
}; 
