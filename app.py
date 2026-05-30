import streamlit as st
import pandas as pd
import sqlite3
from pathlib import Path

# --- CONFIGURATION ---
st.set_page_config(page_title="PolyBridge Dashboard", page_icon="🌉", layout="wide")
DB_PATH = Path("data/polyglot.db")

# Helper function to grab data safely for the UI
def get_data(query):
    try:
        conn = sqlite3.connect(DB_PATH)
        df = pd.read_sql_query(query, conn)
        conn.close()
        return df
    except Exception as e:
        st.error(f"Database error: {e}")
        return pd.DataFrame()

# --- HEADER ---
st.title("🌉 PolyBridge: Learning Dashboard")
st.markdown("Track your errors, understand your interference, and conquer false friends.")

# --- TABS ---
tab1, tab2, tab3, tab4 = st.tabs([
    "📓 Error Notebook", 
    "📈 Progress Charts", 
    "⚠️ False Friends Encountered", 
    "📤 Generated Reports"
])

# TAB 1: ERROR NOTEBOOK
with tab1:
    st.header("Recent Language Errors")
    df_errors = get_data(
        "SELECT timestamp, mistake, correction, category, interference_lang, context, notes FROM errors ORDER BY timestamp DESC"
    )
    
    if not df_errors.empty:
        # Clean up the timestamp for display
        df_errors['timestamp'] = pd.to_datetime(df_errors['timestamp'], format='mixed', errors='coerce').dt.strftime('%Y-%m-%d %H:%M')
        st.dataframe(df_errors, use_container_width=True, hide_index=True)
    else:
        st.info("No errors logged yet. Talk to your MCP to start tracking!")

# TAB 2: PROGRESS CHARTS
with tab2:
    st.header("Interference Over Time")
    st.markdown("See which of your native languages is causing the most habits to unlearn.")
    
    # Group errors by date and interference language
    df_chart = get_data("""
        SELECT date(timestamp) as date, interference_lang, count(*) as count 
        FROM errors 
        WHERE interference_lang != 'none' AND interference_lang != 'unknown'
        GROUP BY date(timestamp), interference_lang
    """)
    
    if not df_chart.empty:
        # Pivot the table so dates are rows and languages are columns
        pivot_df = df_chart.pivot(index='date', columns='interference_lang', values='count').fillna(0)
        st.line_chart(pivot_df)
    else:
        st.info("Not enough data to graph interference yet.")

# TAB 3: FALSE FRIENDS ENCOUNTERED
with tab3:
    st.header("Discovered False Friends")
    st.markdown("Vocabulary you've encountered that looks familiar but means something else!")
    
    # Your server.py logs these to the vocab table with is_false_friend = 1
    df_ff = get_data(
        "SELECT word, translation as actual_meaning, target_language, first_seen FROM vocab WHERE is_false_friend = 1"
    )
    
    if not df_ff.empty:
        df_ff['first_seen'] = pd.to_datetime(df_ff['first_seen'], format='mixed', errors='coerce').dt.strftime('%Y-%m-%d')
        st.dataframe(df_ff, use_container_width=True, hide_index=True)
    else:
        st.info("No false friends triggered yet.")

# TAB 4: REPORTS
with tab4:
    st.header("Your Progress Reports")
    st.markdown("Ask the Polybridge MCP to generate a report, and it will appear here.")
    
    df_reports = get_data("SELECT generated_at, period, content FROM reports ORDER BY generated_at DESC")
    
    if not df_reports.empty:
        for _, row in df_reports.iterrows():
            # Format the date nicely
            date_str = pd.to_datetime(row['generated_at'], format='mixed', errors='coerce').strftime('%b %d, %Y - %H:%M')
            period_str = str(row['period']).replace('_', ' ').title()
            
            # Use expanders so the page doesn't get infinitely long
            with st.expander(f"📄 Report from {date_str} ({period_str})"):
                st.markdown(row['content'])
    else:
        st.info("No reports generated yet. Ask your MCP: 'Generate a report for all time'!")